FROM ubuntu:latest
MAINTAINER My Self <my@self.com>

RUN apt-get -y install ruby-sinatra
RUN ruby liste.rb
