FROM ubuntu:latest
MAINTAINER My Self <my@self.com>

RUN apt-get update \
&& apt-get install -y ruby-sinatra ruby-sqlite3 puma\
&& apt-get clean
ADD . /app/
CMD ruby /app/liste.rb
