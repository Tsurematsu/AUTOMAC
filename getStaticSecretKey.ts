import postgres from 'postgres';

export default async function getStaticSecretKey(): Promise<string> {
    const sql = postgres(process.env.DATABASE_URL!);
    try {
        const result = await sql<{ value: string }[]>`
            SELECT value FROM config WHERE key = 'static_secret_key' LIMIT 1
        `;
        const row = result[0];
        if (!row) throw new Error("No se encontró 'static_secret_key' en la tabla config.");

        return row.value;
    } finally {
        await sql.end();
    }
}