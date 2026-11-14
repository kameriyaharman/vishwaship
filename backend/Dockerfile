FROM php:8.3-cli
RUN docker-php-ext-install pdo_mysql
WORKDIR /app
COPY . /app
ENV PHP_CLI_SERVER_WORKERS=8
RUN printf "upload_max_filesize=8M\npost_max_size=10M\nmemory_limit=256M\nexpose_php=Off\n" > /usr/local/etc/php/conf.d/app.ini
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} router.php"]
