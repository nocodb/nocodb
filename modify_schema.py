import json

# Read the swagger file
with open('packages/nocodb/src/schema/swagger-v3.json', 'r') as f:
    swagger = json.load(f)

# Find the Field schema
field_schema = swagger['components']['schemas']['Field']

# Add SingleLineText to the oneOf array
singleline_schema = {
    "properties": {
        "type": {
            "enum": ["SingleLineText"]
        }
    }
}

# Insert at the beginning of the oneOf array
field_schema['allOf'][1]['oneOf'].insert(0, singleline_schema)

# Write the modified swagger file
with open('packages/nocodb/src/schema/swagger-v3.json', 'w') as f:
    json.dump(swagger, f, indent=2)

print("Successfully added SingleLineText to Field schema")

