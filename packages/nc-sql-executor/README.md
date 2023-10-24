# run locally
- npm install
- npm run build
- npm run start:prod


# build docker
docker build . -t nc-sql-executor

# sample query
curl localhost:9000/query -X POST -d@t.txt -H "Content-Type: application/json" -v

{
    "query": [
        "SELECT * FROM bookings limit 1"
    ],
    "config": {
        "client": "pg",
        "connection": {
            "host": "3.22.21.158",
            "port": "5432",
            "user": "postgres",
            "password": "**********",
            "database": "demo_small"
        },
        "pool": {
            "min": 0,
            "max": 10
        }
    }
}