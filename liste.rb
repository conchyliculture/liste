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


get '/list' do
    content_type :json
    j = Dir.glob(File.join($recettes_dir,"*")).map{|x| File.basename(x)[0..-6]}
    return j.to_json
end

get '/get' do
    content_type :json
    if params['date']
        # TODO verif
        path = File.join($recettes_dir, params['date']+".json")
        if File.exist?(path)
            j = File.read(File.join($recettes_dir, params['date']+".json"))
            return j
        else
            status 404
        end
    end
    return nil
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


