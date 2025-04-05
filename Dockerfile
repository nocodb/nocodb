# استخدم صورة Node.js كأساس
FROM node:18

# أنشئ مجلد للتطبيق
WORKDIR /app

# انسخ ملفات المشروع إلى الحاوية
COPY . .

# ثبّت pnpm والاعتماديات
RUN corepack enable && corepack prepare pnpm@8.6.6 --activate && pnpm install

# افتح المنفذ الذي يستخدمه التطبيق
EXPOSE 8080

# شغّل التطبيق
CMD ["pnpm", "start"]
