import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Actualiza la dirección MAC de un adaptador de red en Windows usando elevación nativa.
 * @param name El nombre de la interfaz en Windows (Ej: "Ethernet 2")
 * @param description La descripción del hardware (Ej: "Realtek USB GbE...")
 * @param newMac La nueva dirección MAC (con o sin guiones/dos puntos)
 */
export default async function updateMacAddress(name: string, description: string, newMac: string): Promise<void> {
    console.log(`\n[MAC Updater] Preparando actualización para el adaptador:`);
    console.log(`- Nombre: ${name}`);
    console.log(`- Hardware: ${description}`);
    console.log(`- Nueva MAC: ${newMac}\n`);

    const cleanMac = newMac.replace(/[:-]/g, '');

    // 1. El comando real de PowerShell que hace el trabajo
    const innerCommand = `Set-NetAdapterAdvancedProperty -Name '${name}' -RegistryKeyword 'NetworkAddress' -RegistryValue '${cleanMac}'; Restart-NetAdapter -Name '${name}' -Confirm:$false`;

    // 2. Truco Pro: Codificamos el comando a Base64 (UTF-16LE, como lo exige PowerShell).
    // Esto evita que Node.js y PowerShell peleen por quién interpreta las comillas simples o dobles.
    const buffer = Buffer.from(innerCommand, 'utf16le');
    const base64Command = buffer.toString('base64');

    // 3. El comando que invoca UAC y le pasa el script codificado
    const elevateCommand = `Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile -EncodedCommand ${base64Command}'`;
    console.log("[MAC Updater] Solicitando permisos de administrador nativos (UAC)...");

    try {
        await execAsync(`powershell -NoProfile -Command "${elevateCommand}"`);
        console.log(`\n[Éxito] Comando enviado al kernel de Windows.`);
        console.log(`Si aceptaste la pantalla de permisos, tu adaptador se reiniciará en unos segundos con la nueva MAC.`);
    } catch (error) {
        console.error("\n[Error] Falló el intento de interactuar con el sistema operativo.");
        throw error; // Lanzamos el error para que tu index.ts lo capture si es necesario
    }
}