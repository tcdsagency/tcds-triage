$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# List all group IDs
Write-Host "=== All AL3 Record Groups ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT AL3Group, GroupName FROM Groups ORDER BY AL3Group"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host $reader.GetValue(0).ToString().PadRight(10) $reader.GetValue(1).ToString()
}
$reader.Close()

$conn.Close()
