#!/usr/bin/ruby
# encoding: utf-8

require "erb"
require "json"
require "sinatra"

set :bind, "0.0.0.0"
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

$recettes_dir = File.absolute_path(File.join(File.dirname(__FILE__), "stored_recettes"))
$jsonsep = "___"

# Ordre dans lequel trier les rayons (dans l'ordre d'arrivée au supermarché)
$enum_rayon = [
    "FLEG", # Fruits et legumes
    "Poissonnerie",
    "Boucherie",
    "Volaille",
    "Charcuterie",
    "Frais",
    "Fromagerie",
    "Matin",
    "Épicerie",
    "Jus",
    "Alcool",
]

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
        rescue RuntimeError =>e
            add_error("Error parsing JSON file #{path}: #{e.message}")
        end
    end
end

def validate_recette_json(path)
    j = JSON.parse(File.read(path))
    ings_path = File.absolute_path(File.join(File.dirname(__FILE__),"public","ingredients.json"))
    begin
        liste_ingredients = JSON.parse(File.read(ings_path))
    rescue JSON::ParserError => e
        $stderr.puts e
        add_error("Error parsing JSON file #{ings_path}")
        raise e
    end
    raise "No ingredients" if liste_ingredients.size == 0
    unless j.has_key?("recettes")
        raise "missing top key 'recettes'"
    end
    raise "No recette" if j['recettes'].size == 0
    j['recettes'].each do |r|
        raise "missing key 'name' for a recette" unless r['name']
        raise "recette name empty" if r["name"].empty?
        raise "missing key 'ingredients' for a recette" unless r['ingredients']
        raise "recette ingredients empty" if r["ingredients"].empty?
        r["ingredients"].each do |ing|
            raise "missing key 'name' for ingredient in recette #{r['name']}" unless ing['name']
            raise "ingredient name empty in recette #{r['name']}" if ing["name"].empty?
            if ing.has_key?('qty')
                raise "ingredient #{ing['name']} in recette #{r['name']} is not a number but #{ing['qty'].class}" unless (ing['qty'].class == Float or ing['qty'].class == Fixnum)
            end
            if ing.has_key?('unit')
                raise "bad unit '#{ing["unit"]}' for ingredient #{ing['name']} in recette #{r['name']}" unless ["g", "cL", "L", " tranche(s)"].include?(ing["unit"])
            end
            if not liste_ingredients.has_key?(ing['name'])
                raise "ingredient #{ing['name']} in recette #{r['name']} is not in \"ingredients\" list"
            end
        end

    end
end

get '/get-stored-listes' do
    content_type :json
    liste = []
    Dir.glob(File.join($recettes_dir,"*.json")).each do |j|
        jj = JSON.parse(File.read(j))
        liste << jj
    end
    return liste.to_json
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
    begin
        save(request.body.read)
    rescue Exception =>e
    rescue Exception =>e 
        status 500
        "Couldn't save recette #{e.message}"
    end
end

get '/ingredients' do
    ings_path = File.absolute_path(File.join(File.dirname(__FILE__),"public","ingredients.json"))
    j = JSON.parse(File.read(ings_path))
    j.each{|k,v| v["rayon"] = $enum_rayon.index(v["rayon"])}
    JSON.generate(j)
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
