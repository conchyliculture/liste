DIRNAME=`dirname "$0"`

echo "Testing backend"
ruby $DIRNAME/tests.rb

echo "Angular unit tests"
ruby "$DIRNAME/../liste.rb"
