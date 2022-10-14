export function convertUnits(unit: string, langauge: "mysql" | "mssql" | "pg" ) {
    switch(unit) {
        case "milliseconds":
        case "ms": {
            if (langauge === "mssql") {
                return "millisecond";
            }

            if (langauge === "mysql") {
                return "FRAC_SECOND";
            }

            if (langauge === "pg") {
                return "milliseconds";
            }

            return unit;
        }
        case "seconds":
        case "s": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "second";
            }

            if (langauge === "mysql") {
                return "SECOND";
            }

            return unit;
        }
        case "minutes":
        case "m": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "minute";
            }

            if (langauge === "mysql") {
                return "MINUTE";
            }

            return unit;
        }
        case "hours":
        case "h": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "hour";
            }

            if (langauge === "mysql") {
                return "HOUR";
            }

            return unit;
        }
        case "days":
        case "d": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "day";
            }

            if (langauge === "mysql") {
                return "DAY";
            }

            return unit;
        }
        case "weeks":
        case "w": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "week";
            }

            if (langauge === "mysql") {
                return "WEEK";
            }

            return unit;
        }
        case "months":
        case "M": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "month";
            }

            if (langauge === "mysql") {
                return "MONTH";
            }

            return unit;
        }
        case "quarters":
        case "Q": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "quarter";
            }

            if (langauge === "mysql") {
                return "QUARTER";
            }

            return unit;
        }
        case "years":
        case "y": {
            if (langauge === "mssql" || langauge === 'pg') {
                return "year";
            }

            if (langauge === "mysql") {
                return "YEAR";
            }

            return unit;
        }
        default: {
            return unit;
        }
    }
}