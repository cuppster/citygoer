// # main.js
//
// see: http://developer.mapquest.com/web/products/open
// see: http://open.mapquestapi.com/xapi/
//


// ## global CityGoer object
var CityGoer = function() {

  // default options
  this.options = {
    api     : 'http://127.0.0.1:8126'
  }    
};

var cityGoer = new CityGoer();

// ## ready
//
$(document).ready(function() {

  //var coll = new CityGoerPlacesCollection();
  //var view = new CityGoerPlacesView({ collection: coll, el: $('#places-list') });  
  
  if (navigator.geolocation) {  
  
    /* geolocation is available */  
    
    console.log('fetching location...');
    navigator.geolocation.getCurrentPosition(function(position) {
    
      console.log(position);
      fetchPlaces(position.coords);
      
    }, function(error) {    
      console.log(error);    
    });

  } else {  
    alert("I'm sorry, but geolocation services are not supported by your browser.");  
  } 
});


// ## got the coords, now fetch the places and render a list
//
function fetchPlaces(coords) {

  var near = { lat: coords.latitude, lon: coords.longitude };
  
  // collection
  var coll = new CityGoerPlacesCollection(null, {near: near, placeType: "pub"});
  
  coll
    .on('loading', function() {
      $.mobile.showPageLoadingMsg();
    })
    .on('reset', function() {
       $.mobile.hidePageLoadingMsg();
    })
    .on('fetch-error', function() {
      $.mobile.changePage("#errorPage");
    });
  
  var view = new CityGoerPlacesView({ collection: coll, el: $('#places-list') });  


}


//---------------------------------------------------------------------------
//
// BACKBONE SUPPORT 
//
//---------------------------------------------------------------------------


// ## Place Model
//
var CityGoerPlaceModel = Backbone.Model.extend({
  
  // whatever!
 
});

// ## Places Collection
//
var CityGoerPlacesCollection = Backbone.Collection.extend({
  
  model: CityGoerPlaceModel,

  url : function() {
    //console.log(this);
    var near = this.near || {}; // TODO provide default coords
    var placeType = this.placeType || "*";
    //console.log("near = ", near);
    return cityGoer.options.api + '/stuff?lat=' + near.lat + '&lon=' + near.lon + '&type=' + placeType;
  },
  
  initialize: function(models, options) {
   
    this.near = options.near;
    this.placeType = options.placeType;
  }
  
});

// ## Place View
//
var CityGoerPlaceView = Backbone.View.extend({

  render: function() {
   
    // ### insert templated place
    
    //var template = _.template($('#place-template').text());   
    //var html = template(this.model.toJSON());
    
    var template = $('#place-template').text();
    
    // format some things...
    var json = this.model.toJSON();
    if (json.taglist)
      json.taglistString = json.taglist.join(', ');
    
    var html = Mustache.render(template, json);    
    $(this.el).append(html);
  
    return this;
  },
});

// ## Places View
//
var CityGoerPlacesView = Backbone.View.extend({

  // render the collection
  //
  render: function() {
  
    console.log('rendering places collection');
    var parent = $(this.el);
    
    this.collection.each(function(model) {
      
      // create new element
      var child = $('<li>');
      
      // create view for model  
      var placeView = new CityGoerPlaceView({el: child, model: model});
      placeView.render();
      
      // insert elements
      parent.append(child);
      
    });
    
    // refresh any new widgets
    //$('#places-list').trigger('refresh'); // NOTE DO NOT USE!
    $('#places-list').listview('refresh');
    return this;
  },  
  
  // init the collection view
  //
  initialize: function() {
    
    // get the associated collection
    var coll = this.collection;    
    if (null !== coll) {
    
      // bind the reset event after the collection is retrieved
      coll.on("reset", function(data) {  
        //console.log('got data');
        //console.log(data);
        this.render();
      }, this);
    
      // fetch from the server
      coll.trigger("loading");   
      coll.fetch({
        error: function(collection, response) {
          coll.trigger('fetch-error');
          //console.log ("ERROR on fetch", response);
        }
      });
    }
  }
  
});