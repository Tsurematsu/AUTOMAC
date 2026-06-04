import CryptoJS from 'crypto-js';
import mqtt from 'mqtt';
import QRCode from 'qrcode';
import listPhysicalAdapters from './listPhysicalAdapters';
import updateMacAddress from './updateMacAddress';
const SECRET_KEY = "FJFDIOKKR45";

async function main() {
    function generarQR(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            QRCode.toString(url, { type: 'terminal', small: true, margin: 1 }, (err, qr) => {
                if (err) { reject(err); return; }
                console.log(qr);
                resolve();
            });
        });
    }

    function encriptarDatos(datos: any, claveSecretaDinamica: string): string {
        const textoAEncriptar = typeof datos === 'string' ? datos : JSON.stringify(datos);
        const textoCifrado = CryptoJS.AES.encrypt(textoAEncriptar, claveSecretaDinamica).toString();
        return textoCifrado;
    }

    function desencriptarDatos(textoCifrado: string, claveSecretaDinamica: string): any {
        try {
            const bytes = CryptoJS.AES.decrypt(textoCifrado, claveSecretaDinamica);
            const textoOriginal = bytes.toString(CryptoJS.enc.Utf8);
            try {
                return JSON.parse(textoOriginal);
            } catch {
                return textoOriginal;
            }
        } catch (error) {
            console.error("Fallo al desencriptar. ¿La llave secreta es incorrecta o el texto está corrupto?");
            return null;
        }
    }

    const informacionSensible = {
        canalAleatorio: Math.random().toString(36).substring(2, 15).toUpperCase(),
        claveSecretaDinamica: Math.random().toString(36).substring(2, 15).toUpperCase(),
    };

    const brokerUrl = 'mqtt://broker.emqx.io:1883';
    const topic = `tsurematsu/acp/${informacionSensible.canalAleatorio}`;


    // ---------------------------------------------------------------------------------
    const adaptadoresRed = await listPhysicalAdapters();
    console.log("Adaptadores de red físicos encontrados:");
    console.table(adaptadoresRed);
    if (adaptadoresRed.length === 0) return console.log("No se encontraron adaptadores de red físicos en este sistema.");
    const adaptadorEthernet = adaptadoresRed.find(adaptador => adaptador.Name.toLowerCase().includes("ethernet") && !adaptador.Name.toLowerCase().includes("wifi"));
    if (!adaptadorEthernet) return console.log("No se encontró un adaptador de red Ethernet físico en este sistema.");
    console.log("Adaptador seleccionado: ");
    console.table(adaptadorEthernet);
    // ---------------------------------------------------------------------------------

    const paqueteSeguro = encriptarDatos(informacionSensible, SECRET_KEY);
    const urlCompartible = `https://geomac-azure.vercel.app/?share-key=${paqueteSeguro}`;
    console.log("URL para compartir: ", urlCompartible);

    const client = mqtt.connect(brokerUrl);
    await new Promise<void>((resolve, reject) => {

        const conexionTimeout = setTimeout(() => {
            reject(new Error("❌ Timeout: No se pudo conectar al broker MQTT en 10 segundos."));
            client.end();
        }, 10000);

        client.on('connect', () => {
            clearTimeout(conexionTimeout);
            console.log('✅ Backend Node.js conectado con éxito.');

            client.subscribe(topic, async (err) => {
                if (!err) {
                    console.log(`📡 Suscrito al canal: ${topic}`);
                    const mensajeEncriptado = encriptarDatos(
                        "¡Hola Frontend! El backend Node.js está en línea 🚀",
                        informacionSensible.claveSecretaDinamica
                    );
                    client.publish(topic, mensajeEncriptado);
                    await generarQR(urlCompartible);
                }
            });
        });

        client.on('message', async (canal, mensaje) => {
            const mensajeDesencriptado = desencriptarDatos(mensaje.toString(), informacionSensible.claveSecretaDinamica);

            if (typeof mensajeDesencriptado !== 'object' || !mensajeDesencriptado?.macAddress) return;

            const macRegex = /^([0-9A-Fa-f]{2}([-:]?)){5}([0-9A-Fa-f]{2})$/;
            if (!macRegex.test(mensajeDesencriptado.macAddress)) {
                console.error("La dirección MAC recibida no es válida.");
                return;
            }

            console.log("Aplicando Mac al dispositivo:", mensajeDesencriptado.macAddress);
            await updateMacAddress(adaptadorEthernet.Name, adaptadorEthernet.InterfaceDescription, mensajeDesencriptado.macAddress);
            console.log("Cambio solicitado. Esperando confirmación del sistema...\n");

            // ✅ Polling en "hilo aparte"
            const macEsperada = mensajeDesencriptado.macAddress.replace(/[-:]/g, '').toUpperCase();
            const intervalo = setInterval(async () => {
                const adaptadores = await listPhysicalAdapters();
                const adaptadorActualizado = adaptadores.find(a => a.Name === adaptadorEthernet.Name);
                const macActual = adaptadorActualizado?.MacAddress?.replace(/[-:]/g, '').toUpperCase();

                if (macActual === macEsperada) {
                    clearInterval(intervalo);
                    console.log("✅ MAC confirmada en el sistema:");
                    console.table(adaptadores);
                    resolve(); // 🎯 Resuelve la promesa y termina el proceso
                } else {
                    console.log(`⏳ Esperando... MAC actual: ${adaptadorActualizado?.MacAddress}`);
                }
            }, 2000); // revisa cada 2 segundos

            // Timeout de seguridad por si nunca cambia
            setTimeout(() => {
                clearInterval(intervalo);
                console.error("⚠️ Timeout: La MAC no cambió después de 30 segundos.");
                resolve(); // igual terminamos para no quedar colgados
            }, 30000);
        });

        client.on('error', (err) => {
            clearTimeout(conexionTimeout);
            reject(err);
        });

    }); // ← cierre del await new Promise

} // ← cierre de main()
main().catch(console.error);