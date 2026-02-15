$conn = New-Object System.Data.OleDb.OleDbConnection
$conn.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Users\ToddConn\tcds-triage\scripts\AL3.mdb"
$conn.Open()

$tables = $conn.GetSchema("Tables")
Write-Host "Tables in AL3.mdb:"
$tables | Where-Object { $_.TABLE_TYPE -eq "TABLE" } | ForEach-Object { Write-Host "  " $_.TABLE_NAME }

$conn.Close()
