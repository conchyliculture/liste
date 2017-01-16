#!/usr/bin/ruby
# encoding: utf-8

require "json"
require 'sinatra'
require "pp"

$recettes_dir = File.join(File.dirname(__FILE__), "recettes")

before do 
    if not File.exists?($recettes_dir)
        Dir.mkdir($recettes_dir)
    end
end

def liste_recettes()
    Dir.glob(File.join($recettes_dir,"*")).map{|x| File.basename(x)[0..-6]}
end

get '/list' do 
    Dir.glob(File.join($recettes_dir,"*")).map{|x| File.basename(x)[0..-6]}
end

get '/load' do
    if params['date']
    else
        return liste_recettes().to_json
    end
end

def save(data)
    json = JSON.parse(data)
    nom = json["name"]
    recettes = json["recettes"]
    path = File.join($recettes_dir, nom+".json")
    if File.exist?(path)
        return "File exists"
    end
    File.open(path, "w") do |f|
        f.write recettes.to_json
    end
    nil
end

post '/save' do
     save(request.body.read)
     pp "saving"
end

get '/' do
    File.read("public/index.html")
end


