import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from models.noshow_model import NoShowPredictor
from models.recommender import score_and_rank_flights

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

app = Flask(__name__)
CORS(app)

predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        predictor = NoShowPredictor()
    return predictor

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "skyvoyage-ml-service",
        "version": "1.0.0",
        "model": "Logistic Regression (No-Show)",
        "features": get_predictor().feature_names
    })

@app.route("/metrics", methods=["GET"])
def metrics():
    p = get_predictor()
    return jsonify({
        "modelName": "Airline Passenger No-Show Predictor",
        "algorithm": "Logistic Regression with L2 Regularization & Standard Scaling",
        "metrics": p.metrics
    })

@app.route("/predict/no-show", methods=["POST"])
def predict_no_show():
    data = request.get_json() or {}
    lead_time = data.get("lead_time", 14)
    fare_class = data.get("fare_class", "economy")
    is_weekend = data.get("is_weekend", 0)
    group_size = data.get("group_size", 1)
    is_loyalty = data.get("is_loyalty", 0)
    has_checked_bag = data.get("has_checked_bag", 0)
    flight_duration_hours = data.get("flight_duration_hours", 4.5)
    total_seats = data.get("total_seats", 180)

    result = get_predictor().predict(
        lead_time=lead_time,
        fare_class=fare_class,
        is_weekend=is_weekend,
        group_size=group_size,
        is_loyalty=is_loyalty,
        has_checked_bag=has_checked_bag,
        flight_duration_hours=flight_duration_hours,
        total_seats=total_seats
    )

    return jsonify(result)

@app.route("/recommend", methods=["POST"])
def recommend_flights():
    data = request.get_json() or {}
    flights = data.get("flights", [])
    preferred_time = data.get("preferred_time", "any")
    sort_by = data.get("sort_by", "recommended")

    ranked = score_and_rank_flights(
        flights=flights,
        preferred_time=preferred_time,
        sort_by=sort_by
    )

    return jsonify({
        "totalFlights": len(ranked),
        "results": ranked
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"\n[ML Engine] SkyVoyage ML Micro-Service starting on port {port}...")
    # Pre-warm model
    get_predictor()
    app.run(host="0.0.0.0", port=port, debug=False)
