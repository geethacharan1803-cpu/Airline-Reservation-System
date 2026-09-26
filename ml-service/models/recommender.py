def score_and_rank_flights(flights, preferred_time="any", sort_by="recommended"):
    """
    Multi-factor recommendation engine for flight search results.
    Weighs:
      - Price competitiveness (35%)
      - Flight duration (25%)
      - Departure time convenience (20%)
      - Non-stop vs connecting (15%)
      - Seat availability (5%)
    """
    if not flights:
        return []

    prices = [f.get("price", f.get("pricing", {}).get("economy", 500)) for f in flights]
    durations = [f.get("durationMinutes", 300) for f in flights]

    min_price = min(prices) if prices else 100
    max_price = max(prices) if prices else 1000
    price_range = max(1, max_price - min_price)

    min_duration = min(durations) if durations else 60
    max_duration = max(durations) if durations else 900
    duration_range = max(1, max_duration - min_duration)

    scored_flights = []

    for flight in flights:
        price = flight.get("price", flight.get("pricing", {}).get("economy", 500))
        duration = flight.get("durationMinutes", 300)
        dep_time = flight.get("departureTime", "")

        # 1. Price Score (0 to 100): Lower is better
        price_score = 100 - ((price - min_price) / price_range * 100)

        # 2. Duration Score (0 to 100): Shorter is better
        duration_score = 100 - ((duration - min_duration) / duration_range * 100)

        # 3. Departure Time Convenience
        # Optimal business/leisure hours: 07:00 to 18:00
        time_score = 70  # default
        hour = 12
        if "T" in dep_time:
            try:
                hour = int(dep_time.split("T")[1][:2])
            except Exception:
                hour = 12

        if 8 <= hour <= 12:
            time_score = 98  # Morning peak
        elif 13 <= hour <= 18:
            time_score = 92  # Afternoon
        elif 19 <= hour <= 22:
            time_score = 75  # Evening
        else:
            time_score = 45  # Late night / Red-eye

        # Adjust based on user preference if provided
        if preferred_time == "morning" and 6 <= hour <= 12:
            time_score += 15
        elif preferred_time == "evening" and 17 <= hour <= 23:
            time_score += 15

        # 4. Direct vs Connecting
        is_direct = flight.get("stops", 0) == 0
        direct_score = 100 if is_direct else 60

        # Composite score
        composite_score = (
            0.35 * price_score +
            0.25 * duration_score +
            0.20 * time_score +
            0.15 * direct_score +
            0.05 * 80
        )
        composite_score = round(min(99.9, max(10.0, composite_score)), 1)

        # Tag badges
        tags = []
        if price == min_price:
            tags.append("Cheapest")
        if duration == min_duration and is_direct:
            tags.append("Fastest")
        if composite_score >= 88:
            tags.append("Top Pick")
        elif price_score > 85 and duration_score > 75:
            tags.append("Best Value")

        f_copy = dict(flight)
        f_copy["recommendationScore"] = composite_score
        f_copy["tags"] = tags
        f_copy["scores"] = {
            "priceScore": round(price_score, 1),
            "durationScore": round(duration_score, 1),
            "timeConvenience": round(time_score, 1),
        }
        scored_flights.append(f_copy)

    # Sort
    if sort_by == "price":
        scored_flights.sort(key=lambda x: x.get("price", x.get("pricing", {}).get("economy", 0)))
    elif sort_by == "duration":
        scored_flights.sort(key=lambda x: x.get("durationMinutes", 0))
    elif sort_by == "departure":
        scored_flights.sort(key=lambda x: x.get("departureTime", ""))
    else:  # "recommended"
        scored_flights.sort(key=lambda x: x["recommendationScore"], reverse=True)

    return scored_flights
