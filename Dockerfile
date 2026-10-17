# iSmart On-call — static PWA served by nginx.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE=https://api.ismartfacitech.com/api/v1
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.inc /etc/nginx/oncall-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html
# Readable by nginx whatever the build machine's umask was.
RUN chmod -R a+rX /usr/share/nginx/html /etc/nginx/oncall-headers.inc /etc/nginx/conf.d/default.conf
EXPOSE 80
