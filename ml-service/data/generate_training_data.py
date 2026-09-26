import numpy as np

def generate_booking_data(n_samples=10000, random_state=42):
    """
    Generates synthetic but realistic airline booking dataset.
    Features:
      - lead_time: [0..180] days
      - fare_class: 0 (Economy), 1 (Business), 2 (First)
      - is_weekend: 0 or 1
      - group_size: 1..6
      - is_loyalty: 0 or 1
      - has_checked_bag: 0 or 1
      - flight_duration_hours: 1.0..14.0
    Target:
      - no_show: 0 (boarded) or 1 (no-show)
    """
    np.random.seed(random_state)

    lead_time = np.random.exponential(scale=28, size=n_samples)
    lead_time = np.clip(lead_time, 0, 180).astype(int)

    # Fare class distribution: 75% Economy, 20% Business, 5% First
    fare_class = np.random.choice([0, 1, 2], size=n_samples, p=[0.75, 0.20, 0.05])

    # Weekend flight flag (Fri/Sat/Sun)
    is_weekend = np.random.binomial(n=1, p=0.42, size=n_samples)

    # Group size (skewed towards 1 and 2)
    group_size = np.random.choice([1, 2, 3, 4, 5, 6], size=n_samples, p=[0.55, 0.25, 0.10, 0.05, 0.03, 0.02])

    # Frequent flyer loyalty membership
    loyalty_probs = np.where(fare_class == 2, 0.75, np.where(fare_class == 1, 0.50, 0.20))
    is_loyalty = np.random.binomial(n=1, p=loyalty_probs)

    # Checked baggage added
    has_checked_bag = np.random.binomial(n=1, p=0.65, size=n_samples)

    # Flight duration in hours
    flight_duration_hours = np.random.uniform(1.2, 14.5, size=n_samples).round(1)

    # True Logistic Model equation for ground truth probability
    z = (
        -2.3
        + 0.012 * lead_time                 # longer lead time increases no-show
        - 0.95 * (fare_class == 1)          # business class shows up much more
        - 1.40 * (fare_class == 2)          # first class almost never misses
        + 0.18 * is_weekend                 # weekend getaways slightly higher cancellations
        - 0.25 * (group_size - 1)           # families/groups cancel together much less
        - 0.55 * is_loyalty                 # loyalty members have strong incentives to show up
        - 0.40 * has_checked_bag            # prepayment for bags commits passengers
        - 0.03 * flight_duration_hours      # long-haul international flights are rarely skipped
        + np.random.normal(0, 0.25, size=n_samples)  # noise
    )

    # Sigmoid function
    prob = 1.0 / (1.0 + np.exp(-z))
    no_show = (np.random.rand(n_samples) < prob).astype(int)

    X = np.column_stack([
        lead_time,
        fare_class,
        is_weekend,
        group_size,
        is_loyalty,
        has_checked_bag,
        flight_duration_hours
    ])
    y = no_show

    feature_names = [
        "lead_time",
        "fare_class",
        "is_weekend",
        "group_size",
        "is_loyalty",
        "has_checked_bag",
        "flight_duration_hours"
    ]

    return X, y, feature_names

if __name__ == "__main__":
    X, y, features = generate_booking_data()
    print(f"Generated {len(y)} samples.")
    print(f"Features: {features}")
    print(f"Overall no-show rate: {y.mean() * 100:.2f}%")
