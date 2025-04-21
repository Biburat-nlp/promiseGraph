import time
import json
import redis
import requests
import logging
from flask import Flask, jsonify, request
from datetime import datetime
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = Flask(__name__)
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)

HEADERS = {
    "Content-Type": "application/json",
    "system-name": "Prefektura_UVAO",
    "system-password": "78ldU(159dem91w5(w!wx"
}

URL_FIND = "https://api-gorod.mos.ru/api/issues/issue/find"
URL_GET = "https://api-gorod.mos.ru/api/issues/issue/get"


def fetch_full_issue_data(issue_ids):
    payload = {
        "ids": issue_ids,
        "expand": ["comments", "comments.attachments", "object",
                   "comments.monitor", "comments.monitor.violation_name",
                   "comments.monitor.element_2"]
    }
    response = requests.post(URL_GET, json=payload, headers=HEADERS, verify=False)

    if response.status_code == 200:
        return response.json().get("data", [])
    else:
        logging.error(f"❌ Ошибка запроса данных ({response.status_code}): {response.text}")
        return []

def update_cache():
    while True:
        logging.info("🔄 Запрос данных с основного сервера...")

        all_issue_ids = []
        offset = 0
        limit = 500

        while True:
            logging.info(f"📡 Запрос с offset={offset}...")
            payload = {
                "filter": {
                    "condition": [
                        "and",
                        ["=", "assignments.role_code", "oiv1"],
                        ["in", "assignments.organization_id",
                         [9150]], ##
                        ["or",
                         ["=", "public_status.title", "Проблема в работе"],
                         ]
                    ],
                    "limit": limit,
                    "offset": offset
                }
            }

            response = requests.post(URL_FIND, json=payload, headers=HEADERS, verify=False)

            if response.status_code == 200:
                data = response.json()
                issue_ids = data.get("data", {}).get("items", [])

                if not issue_ids:
                    logging.info("✅ Все данные загружены, дальнейших данных нет.")
                    break

                all_issue_ids.extend(issue_ids)
                logging.info(f"Получено {len(issue_ids)} ID (всего: {len(all_issue_ids)})")

                offset += 500

            else:
                logging.error(f"❌ Ошибка запроса ({response.status_code}): {response.text}")
                break

        if all_issue_ids:
            logging.info(f"🟢 Загружаем полные данные для {len(all_issue_ids)} записей...")

            detailed_data = fetch_full_issue_data(all_issue_ids)

            if detailed_data:
                redis_client.set("cached_issues", json.dumps(detailed_data))
                redis_client.expire("cached_issues", 600)
                logging.info(f"✅ Кеш обновлен ({len(detailed_data)} записей).")
            else:
                logging.warning("⚠️ Полные данные не получены.")

        else:
            logging.warning("⚠️ Нет новых данных для кеширования.")

        logging.info("⏳ Ожидание 5 минут до следующего обновления...")
        time.sleep(600)

def extract_monitor_deadline(comments):
    if isinstance(comments, list):
        for comment in comments:
            monitor = comment.get("monitor")
            if monitor and "deadline_at" in monitor:
                return monitor["deadline_at"]
    return None

@app.route("/chart_data", methods=["GET"])
def chart_data():
    cached_data = redis_client.get("cached_issues")

    if not cached_data:
        return jsonify({"error": "Нет данных в кеше"}), 503

    issues = json.loads(cached_data)

    grouped = defaultdict(int)

    for issue in issues:
        comments = issue.get("comments", [])
        deadline_str = extract_monitor_deadline(comments)
        if not deadline_str:
            continue

        try:
            deadline = datetime.fromisoformat(deadline_str)
            date_key = deadline.strftime("%Y-%m-%d")
            grouped[date_key] += 1
        except ValueError:
            continue

    result = [{"date": date, "count": count} for date, count in sorted(grouped.items())]
    return jsonify(result)

@app.route("/find_issue", methods=["GET"])
def find_issue():
    logging.info("Получен запрос в /find_issue")

    issue_id = request.args.get("issue_id")
    logging.info(f"Параметры запроса: issue_id={issue_id}")

    if not issue_id:
        logging.warning("⚠️ Не указан issue_id в запросе!")
        return jsonify({"error": "Не указан issue_id"}), 400

    try:
        issue_id = int(issue_id)
    except ValueError:
        logging.warning(f"⚠️ Некорректное значение issue_id: {issue_id}")
        return jsonify({"error": "Некорректный issue_id"}), 400

    logging.info(f"Запрос данных по issue_id={issue_id} на основной сервер")

    payload = {
        "ids": [issue_id],
        "expand": ["comments", "comments.attachments", "object",
                   "comments.monitor", "comments.monitor.violation_name",
                   "comments.monitor.element_2"]
    }

    logging.debug(f"Отправляем запрос на основной сервер: {URL_GET}")
    logging.debug(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")

    try:
        response = requests.post(URL_GET, json=payload, headers=HEADERS, verify=False)

        logging.info(f"Ответ от основного сервера: статус {response.status_code}")

        if response.status_code == 200:
            try:
                data = response.json().get("data", [])
                logging.debug(f"📜 Данные от сервера: {json.dumps(data, indent=2, ensure_ascii=False)}")

                if data:
                    logging.info(f"✅ Найдены данные по issue_id={issue_id}")
                    return jsonify(data[0])
                else:
                    logging.warning(f"❌ Обращение {issue_id} не найдено.")
                    return jsonify({"error": "Обращение не найдено"}), 404
            except json.JSONDecodeError:
                logging.error(f"❌ Ошибка декодирования JSON! Ответ: {response.text}")
                return jsonify({"error": "Ошибка обработки данных от сервера"}), 500
        else:
            logging.error(f"❌ Ошибка запроса ({response.status_code}): {response.text}")
            return jsonify({"error": f"Ошибка при запросе: {response.status_code}"}), response.status_code

    except requests.RequestException as e:
        logging.exception("Ошибка выполнения HTTP-запроса")
        return jsonify({"error": "Ошибка при запросе к основному серверу"}), 500

@app.route("/get_issues", methods=["GET"])
def get_issues():
    cached_data = redis_client.get("cached_issues")

    if cached_data:
        logging.info("🟢 Данные получены из кеша.")
        return jsonify(json.loads(cached_data))
    else:
        logging.warning("🔴 Данных в кеше нет.")
        return jsonify({"error": "Данные ещё не загружены"}), 503


if __name__ == "__main__":
    from threading import Thread

    cache_updater = Thread(target=update_cache, daemon=True)
    cache_updater.start()

    logging.info("🚀 Сервер запущен на порту 5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
