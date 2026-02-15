$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# Get column names for CodesAL3
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM CodesAL3"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
Write-Host "Columns in CodesAL3:"
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Sample data from CodesAL3
Write-Host ""
Write-Host "Sample data from CodesAL3 (first 20 rows):"
$cmd.CommandText = "SELECT TOP 20 * FROM CodesAL3"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $row = ""
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $row += $reader.GetValue($i).ToString() + " | "
    }
    Write-Host $row
}
$reader.Close()

$conn.Close()
