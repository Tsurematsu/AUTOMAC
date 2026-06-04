import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Definimos la interfaz para el tipado estricto
export interface NetworkAdapter {
    Name: string;                 // Ej: "Ethernet 2"
    InterfaceDescription: string; // Ej: "Realtek USB GbE Family Controller"
    MacAddress: string;           // Ej: "00-1A-2B-3C-4D-5E"
    Status: string;               // Ej: "Up" o "Disconnected"
}

/**
 * Obtiene una lista de todos los adaptadores de red físicos del sistema (Windows).
 * @returns Promesa que resuelve en un array de objetos NetworkAdapter.
 */
export default async function listPhysicalAdapters(): Promise<NetworkAdapter[]> {
    // Comando para obtener adaptadores físicos, seleccionar campos útiles y exportar a JSON
    const psCommand = `Get-NetAdapter -Physical | Select-Object Name, InterfaceDescription, MacAddress, Status | ConvertTo-Json`;

    try {
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand}"`);
        
        if (!stdout || stdout.trim() === '') {
            return [];
        }

        const parsedData = JSON.parse(stdout);
        
        // PowerShell ConvertTo-Json devuelve un objeto si hay 1 solo resultado, 
        // o un array si hay múltiples. Normalizamos esto a un array siempre.
        return Array.isArray(parsedData) ? parsedData : [parsedData];
        
    } catch (error) {
        console.error('[Error] Fallo al intentar listar los adaptadores de red:', error);
        return []; // Retornamos un array vacío para no romper la ejecución de quien llame a la función
    }
}