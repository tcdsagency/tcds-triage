$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# Look at DDE table structure
Write-Host "=== DDE Table Columns ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM DDE"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

Write-Host ""
Write-Host "=== Sample DDE Data ==="
$cmd.CommandText = "SELECT TOP 10 * FROM DDE"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $row = ""
    for ($i = 0; $i -lt [Math]::Min(8, $reader.FieldCount); $i++) {
        $row += $reader.GetValue($i).ToString().Substring(0, [Math]::Min(15, $reader.GetValue($i).ToString().Length)) + " | "
    }
    Write-Host $row
}
$reader.Close()

$conn.Close()
