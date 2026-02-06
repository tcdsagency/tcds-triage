const mssql = require('mssql');

const config = {
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
};

async function check() {
  const pool = await mssql.connect(config);

  // Check recent recordings (last 50)
  const result = await pool.request().query(`
    SELECT TOP 50 RecordId, Ext, CallerExt, DialedNum, RecordingDate, Duration,
           CASE WHEN Transcription IS NULL THEN 'NULL'
                WHEN LEN(Transcription) = 0 THEN 'EMPTY'
                ELSE 'LEN=' + CAST(LEN(Transcription) AS VARCHAR) END as TranscriptStatus
    FROM Recordings
    ORDER BY RecordingDate DESC
  `);

  console.log("Today's recordings:");
  for (const r of result.recordset) {
    const date = new Date(r.RecordingDate).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log(`${date} | Ext:${r.Ext} | ${r.CallerExt} -> ${r.DialedNum} | ${r.Duration} | ${r.TranscriptStatus}`);
  }

  await pool.close();
}

check().catch(console.error);
