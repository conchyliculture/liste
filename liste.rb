#!/usr/bin/ruby
# encoding: utf-8

require "json"
require 'sinatra'
require "pp"

$recettes_dir = File.join(File.dirname(__FILE__), "stored_recettes")

before do
    if not File.exists?($recettes_dir)
        Dir.mkdir($recettes_dir)
    end
end

get '/get-stored-listes' do
    content_type :json
    liste = []
    Dir.glob(File.join($recettes_dir,"*.json")).each do |j|
        jj = JSON.parse(File.read(j))
        liste << {'name' => jj["name"], 'date' => jj["date"]}
    end
    return liste.to_json
end

get '/get-stored-liste' do
    content_type :json
    if params['name']
        n,d = params['name'].split(" - ")
        # TODO verif
        path = File.join($recettes_dir, File.basename("#{d}-#{n}.json"))
        if File.exist?(path)
            j = File.read(path)
            return j
        else
            $stderr.puts "Can't find liste '#{path}'"
        end
    end
    status 404
    return nil
end

def save(data)
    json = JSON.parse(data)
    nom = json["name"]
    if nom =~ /[a-z0-9 ]+/i
        recettes = json["recettes"]
        date = Time.now().strftime("%Y-%m-%dT%H-%M-%S")
        json["date"] = date
        path = File.join($recettes_dir,"#{date}-#{nom}.json")
        if File.exist?(path)
            status 500
            return "File exists"
        end
        File.open(path, "w") do |f|
            f.write JSON.pretty_generate(json)
        end
        return "done"
    else
        status 500
    end
end

post '/save' do
     save(request.body.read)
end

get '/' do
    File.read(File.join(File.dirname(__FILE__),"public/index.html"))
end


