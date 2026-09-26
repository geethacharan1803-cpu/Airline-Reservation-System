$ErrorActionPreference = "Stop"

Write-Output "--- Testing SeatWatch Subscription ---"
$subBody = @{
    flightId = 725
    passengerId = 10
    passengerName = "Alice Smith"
    contactEmail = "alice@example.com"
    preferredSeatType = "window"
    loyaltyTier = "platinum"
    maxUpgradeBid = 85.0
} | ConvertTo-Json

$subRes = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/seatwatch/subscribe" -Method Post -Body $subBody -ContentType "application/json"
Write-Output "Enrolled watchId: $($subRes.watchId), PriorityScore: $($subRes.priorityScore)"

Write-Output "`n--- Checking Active Alerts for Passenger 10 ---"
$alertsRes = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/seatwatch/alerts/10"
Write-Output "Current pending alerts: $($alertsRes.alerts.Count)"

Write-Output "`nSUCCESS: SeatWatch REST endpoints verified on running server!"
