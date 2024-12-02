FROM ghcr.io/actions/actions-runner:latest

USER root

# Install dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm-dev libxkbcommon-dev libgbm-dev libasound-dev \
    libatspi2.0-0 libxshmfence-dev python3 python3-pip curl zip sudo rsync jq \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

    # Install Node.js (and npm, which includes npx)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
  apt-get install -y nodejs && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PostgreSQL
RUN apt-get update && \
    apt-get -y install gnupg gnupg2 gnupg1 -y postgresql-14

# Install MySQL
RUN apt install mysql-server -y

# Install Playwright
RUN npx playwright install --with-deps chromium

USER runner
