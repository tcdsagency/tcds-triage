$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# Look at Groups table structure
Write-Host "=== Groups Table Columns ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM Groups"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Look for discount-related groups
Write-Host ""
Write-Host "=== Discount-Related Record Groups ==="
$cmd.CommandText = "SELECT * FROM Groups WHERE GroupName LIKE '%discount%' OR GroupName LIKE '%DSC%' OR GroupID LIKE '%DSC%'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $row = ""
    for ($i = 0; $i -lt 5; $i++) {
        if ($i -lt $reader.FieldCount) {
            $row += $reader.GetValue($i).ToString() + " | "
        }
    }
    Write-Host $row
}
$reader.Close()

# Look for 6CVA and 6CVH groups
Write-Host ""
Write-Host "=== 6CVA/6CVH Record Groups ==="
$cmd.CommandText = "SELECT * FROM Groups WHERE GroupID LIKE '6CV%' OR GroupID LIKE '5CV%'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host $reader.GetValue(0).ToString().PadRight(10) $reader.GetValue(1).ToString()
}
$reader.Close()

$conn.Close()
