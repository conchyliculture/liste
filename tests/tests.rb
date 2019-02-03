#!/usr/bin/ruby
# encoding: utf-8
require "fileutils"
require "json"
require "pp"
require "test/unit"
require 'rack/test'

require_relative "../liste.rb"


class TestListe < Test::Unit::TestCase
    include Rack::Test::Methods

    $test_dir = "test_dir"
    $recettes_dir = File.join($test_dir,"recettes")
    $test_liste = {"name":"lolilol","recettes":[{"diner":{"recette":"","gens":10},"dejeuner":{"recette":"Omelette","gens":10}},{"diner":{"recette":"","gens":10},"dejeuner":{"recette":"Croziflette","gens":10}},{"diner":{"recette":"","gens":10},"dejeuner":{"recette":"","gens":10}},{"diner":{"recette":"","gens":10},"dejeuner":{"recette":"","gens":10}},{"diner":{"recette":"","gens":10},"dejeuner":{"recette":"","gens":10}}],"date":"2017-01-25T16-26-38"}

    def setup
        FileUtils.mkdir_p($recettes_dir)
    end

    def teardown
        FileUtils.rm_rf($test_dir)
    end

    def app
        Sinatra::Application
    end

    def test_recettes
        ingredients_path = File.join(File.dirname(File.realpath(__FILE__)), "..", "public", "ingredients.json")
        recettes_path = File.join(File.dirname(File.realpath(__FILE__)), "..", "public", "recettes.json")
        ingredients = JSON.parse(File.open(ingredients_path).read())
        recettes = JSON.parse(File.open(recettes_path).read())
        ingredients_list = ingredients.keys
        recettes["recettes"].each do |recette|
            recette["ingredients"].each do |i|
                assert ingredients_list.include?(i["name"]), "Plz add ingredient #{i['name']} in ingredients.json"
            end
        end
        ingredients.each do |ingredient_name, reste|
            assert reste["rayon"] != nil
        end
    end

    def test_it_gives_recettes
        get '/recettes.json'
        assert last_response.ok?
        j = JSON.parse(last_response.body)
        assert { j['recettes'].size > 5}
        assert_block {j['recettes'][0]["name"] =~/^[a-z ]+$/i}
        assert_block { j['recettes'][0]["ingredients"].size > 3}
    end

    def test_it_gives_index
        get '/'
        assert last_response.ok?
        b = last_response.body
        assert_send([b, :include?, "ng-controller=\"ListeCtrl\""])
    end

    def test_it_gives_stored_lists
        File.open(File.join($recettes_dir,"#{$test_liste[:date]}-#{$test_liste[:name]}.json"),'w+') do |f|
            f.write($test_liste.to_json)
        end
        get '/get-stored-listes'
        assert last_response.ok?
        assert {last_response.body == [$test_liste].to_json }
    end

    def test_it_saves_list
        post '/save', $test_liste.to_json
        assert last_response.ok?
        assert { last_response.body == "done"}

        recette = File.read(Dir.glob($recettes_dir+"/*.json")[0])
        j = JSON.parse(recette)
        assert {j["name"] == "lolilol"}
        assert {j["date"] == Time.now.strftime('%Y-%m-%dT%H-%M-%S')}
    end
end
