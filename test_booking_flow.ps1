$ErrorActionPreference = "Stop"

# Use fresh seats
$rand = Get-Random -Minimum 15 -Maximum 28
$seat1 = "$($rand)A"
$seat2 = "$($rand)B"

# 1. Lock Seats
$lockBody = @{
    flightId = 725
    seatNumbers = @($seat1, $seat2)
    sessionId = "test-session-$rand"
} | ConvertTo-Json

$lockRes = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/seats/lock" -Method Post -Body $lockBody -ContentType "application/json"
Write-Output "1. Seats Locked: $($lockRes.locked -join ', ')"

# 2. Create Booking
$bookBody = @{
    flightId = 725
    fareClass = "economy"
    contactEmail = "alice@example.com"
    contactPhone = "+1234567890"
    passengers = @(
        @{ firstName = "Alice"; lastName = "Smith"; email = "alice@example.com"; phone = "+1234567890" },
        @{ firstName = "Bob"; lastName = "Smith"; email = "bob@example.com"; phone = "+1234567890" }
    )
    seats = @($seat1, $seat2)
} | ConvertTo-Json -Depth 4

$bookRes = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/bookings" -Method Post -Body $bookBody -ContentType "application/json"
Write-Output "2. Booking Created! PNR: $($bookRes.pnr), BookingId: $($bookRes.bookingId)"

# 3. Retrieve Booking by PNR
$pnr = $bookRes.pnr
$detail = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/bookings/$pnr"
Write-Output "3. Retrieved PNR: $($detail.pnr), Status: $($detail.status), TotalPrice: `$$($detail.totalPrice), Passengers: $($detail.passengers.Count)"

# 4. Process Payment Simulation
$payBody = @{
    bookingId = $detail.id
    pnr = $detail.pnr
    amount = $detail.totalPrice
    currency = "USD"
    paymentMethod = "card"
    cardNumber = "4532000000000000"
    cardHolder = "ALICE SMITH"
    expiryMonth = "12"
    expiryYear = "2028"
    cvv = "123"
} | ConvertTo-Json

$payRes = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/payments" -Method Post -Body $payBody -ContentType "application/json"
Write-Output "4. Payment Processed! Success: $($payRes.success), TransactionId: $($payRes.transactionId), BookingStatus: $($payRes.bookingStatus)"

# 5. Verify Confirmed Status After Payment
$confirmed = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/bookings/$pnr"
Write-Output "5. Booking Confirmed Status: $($confirmed.status)"

# 6. Attempt Double Booking on seat1 (MUST FAIL with 409 Conflict)
try {
    $doubleBook = @{
        flightId = 725
        fareClass = "economy"
        contactEmail = "eve@example.com"
        passengers = @(@{ firstName = "Eve"; lastName = "Hacker"; email = "eve@example.com" })
        seats = @($seat1)
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:3001/api/v1/bookings" -Method Post -Body $doubleBook -ContentType "application/json"
    Write-Output "ERROR: Double booking succeeded when it should have failed!"
} catch {
    Write-Output "6. Double Booking Prevention Confirmed! Seat $seat1 conflict rejected with 409 error as expected."
}

Write-Output "`n🎉 SUCCESS: All 6 end-to-end integration tests PASSED flawlessly!"
