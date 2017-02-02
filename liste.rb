#!/usr/bin/ruby
# encoding: utf-8

require "erb"
require "json"
require "sinatra"

$recettes_dir = File.absolute_path(File.join(File.dirname(__FILE__), "stored_recettes"))

def add_error(msg)
    @error_list.push(msg)
    @errormsg = "<h2 class=\"md-toolbar-tools\">"
    @error_list.each do |m|
        @errormsg << "<span>#{m}</span>"
    end
    @errormsg << "</h2>"
end

before do
    @error_list = []
    @errormsg = ""
    recettes_json = [
        File.absolute_path(File.join(File.dirname(__FILE__),"public","recettes.json")),
        File.absolute_path(File.join(File.dirname(__FILE__),"public","matin.json"))
    ]
    recettes_json.each do |path|
        begin
            validate_recette_json(path)
        rescue JSON::ParserError => e
            add_error("Error parsing JSON file #{path}")
        end
    end
end

def validate_recette_json(path)
    j = JSON.parse(File.read(path))
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
        liste = json["liste"]
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
    if not File.exists?($recettes_dir)
        begin
            Dir.mkdir($recettes_dir)
        rescue Errno::EACCES
            add_error("Can't create #{$recettes_dir} directory because of permissions issues (access denied), you won't be able to save listes.")
        end
    end
    erb :main
end
