$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

# Look at DDT table structure
Write-Host "=== DDT Table Columns ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM DDT"
$reader = $cmd.ExecuteReader()
$schemaTable = $reader.GetSchemaTable()
$schemaTable | ForEach-Object { Write-Host "  " $_.ColumnName }
$reader.Close()

# Get field definitions for 6CVA
Write-Host ""
Write-Host "=== 6CVA Field Layout ==="
$cmd.CommandText = "SELECT * FROM DDT WHERE AL3Group = '6CVA' ORDER BY FieldStartPosition"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $startPos = $reader.GetValue(4).ToString()
    $length = $reader.GetValue(5).ToString()
    $fieldName = $reader.GetValue(2).ToString()
    $desc = $reader.GetValue(7).ToString()
    Write-Host $startPos.PadLeft(4) "-" ($startPos + $length).ToString().PadLeft(4) ": " $fieldName.PadRight(25) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

# Get field definitions for 6DIS (Driver Discount)
Write-Host ""
Write-Host "=== 6DIS (Driver Discount) Field Layout ==="
$cmd.CommandText = "SELECT * FROM DDT WHERE AL3Group = '6DIS' ORDER BY FieldStartPosition"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $startPos = $reader.GetValue(4).ToString()
    $length = $reader.GetValue(5).ToString()
    $fieldName = $reader.GetValue(2).ToString()
    $desc = $reader.GetValue(7).ToString()
    Write-Host $startPos.PadLeft(4) "-" $length.PadLeft(3) ": " $fieldName.PadRight(25) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

# Get field definitions for 5DSF (Discount-Surcharge Factor)
Write-Host ""
Write-Host "=== 5DSF (Discount-Surcharge Factor) Field Layout ==="
$cmd.CommandText = "SELECT * FROM DDT WHERE AL3Group = '5DSF' ORDER BY FieldStartPosition"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    $startPos = $reader.GetValue(4).ToString()
    $length = $reader.GetValue(5).ToString()
    $fieldName = $reader.GetValue(2).ToString()
    $desc = $reader.GetValue(7).ToString()
    Write-Host $startPos.PadLeft(4) "-" $length.PadLeft(3) ": " $fieldName.PadRight(25) $desc.Substring(0, [Math]::Min(50, $desc.Length))
}
$reader.Close()

$conn.Close()
