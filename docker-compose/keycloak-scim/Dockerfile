# Stage 1: Build patched keycloak-scim plugin
# Fixes NPE on user delete: https://github.com/mitodl/keycloak-scim/pull/40
FROM gradle:8.5-jdk17 AS plugin-builder

WORKDIR /build
RUN git clone https://github.com/mitodl/keycloak-scim.git .

# Patch: skip getUser()/isEmailVerified() on DELETE (user already gone from DB)
RUN sed -i '85,90c\            if (event.getOperationType() == OperationType.DELETE) {\n                dispatcher.run(ScimDispatcher.SCOPE_USER, client -> client.delete(UserAdapter.class, userId));\n            }' \
    src/main/java/sh/libre/scim/event/ScimEventListenerProvider.java

RUN gradle shadowJar --no-daemon

# Stage 2: Build Keycloak with patched plugin
FROM quay.io/keycloak/keycloak:26.0 AS builder

COPY --from=plugin-builder /build/build/libs/*-all.jar /opt/keycloak/providers/keycloak-scim.jar

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.0

COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
