# استخدم صورة Node الرسمية
FROM node:18

# تحديد مجلد العمل داخل الحاوية
WORKDIR /app

# انسخ ملفات المشروع إلى الحاوية
COPY . .

# ثبّت pnpm والحزم المطلوبة
RUN corepack enable && corepack prepare pnpm@8.6.6 --activate && pnpm install

# ابني المشروع (اختياري حسب الحاجة)
RUN pnpm run build

# افتح المنفذ الذي يستخدمه التطبيق
EXPOSE 8080

# شغّل التطبيق
CMD ["pnpm", "start"]
