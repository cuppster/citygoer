// # main.js
//
// see: http://developer.mapquest.com/web/products/open
// see: http://open.mapquestapi.com/xapi/
//

// ## global CityGoer object
//
var CityGoer = function() {

  // default options
  this.options = {
    //api     : 'http://127.0.0.1:8133' // testing
    api     : 'http://citygoer.com/api'
  }    
};
var cityGoer = new CityGoer();

// ## ready
//
$('#places').live('pageinit',function() {
//$(document).ready(function() {

  // ### capture clicking on place links
  //
  $(document).delegate('a[data-node-id]', 'click', {}, function(e) {
    var target = $(e.currentTarget);
    
    // give the model to the place page
    var model = target.data('model');
    
    // remove existing page, #place-page-template
    $('#place-page').remove();
    
    // insert new markup before naving to pave
    var template = $('#place-page-template').text();
    var html = Mustache.render(template, model.toJSON());  
    $('body').append(html);
    
    // add model to el data
    $('#place-page').data('model', model);
    
    // perform page transition manually
    $.mobile.changePage('#place-page');
  });
  
  // ### capture the check-in button
  //
  $(document).delegate('button[data-node-id]', 'click', {}, function(e) {
  
    // get model from page
    var model = $('#place-page').data('model');
    
    // create new Hear model
    var here = new CityGoerHereModel({
      lat         : model.get('lat'), 
      lon         : model.get('lon'),
      node_id     : model.get('node_id'),
      name        : model.get('name'),
      status      : $('#status').val()
    });
    
    // save model on server
    here.save(null, {
      success: function(model, resonse) {
        
        // perform page transition manually
        $.mobile.changePage('#follow');
        
      },
      error: function(model, response) {
        console.log("ERROR");
        console.log(model);
        console.log(response);
      }
    });
    
    e.stopPropagation();
    return false;
  });
    
  // ### is geolocation available?
  //
  if (false /* test */) {
    // TEST location: lat":"38.8975639","lon":"-77.0202807"   
    
    var coords = { latitude: -77.0202807, longitude: 38.8975639 };
    refreshPlaces(coords);
    
  }
  else if (navigator.geolocation) {  
    
    console.log('fetching location...');
    
    $.mobile.showPageLoadingMsg();
    
    // ### get current position
    //
    navigator.geolocation.getCurrentPosition(function(position) {    
      
      console.log(position);
      
      $.mobile.hidePageLoadingMsg();
      refreshPlaces(position.coords);
      
    }, function(error) {    
    
      // something went wrong...
      console.log(error);   
 
      $.mobile.hidePageLoadingMsg();
      $.mobile.changePage("#errorPage");
    });

  } else {  
    // geolocation is NOT supported!
    alert("I'm sorry, but geolocation services are not supported by your browser.");  
  } 
});

// ## got the coords, now fetch the places and render a list
//
function refreshPlaces(coords) {

  if (!coords) {
    // get from cache
    coords = $('#places').data('coords');
  }
  else {
    // cache position in el
    $('#places').data('coords', coords);
  }
  
  // default
  if (!coords) {
    coords = {lat: 36.175, lon: -115.136389};
  }
  
  // make a 'near' dict
  var near = { lat: coords.latitude, lon: coords.longitude };
  
  // collection
  var coll = new CityGoerPlacesCollection(null, {near: near /*, placeType: "pub" */});
  
  // collection events
  coll
    .on('loading', function() {
      $.mobile.showPageLoadingMsg();
    })
    .on('reset', function() {
       $.mobile.hidePageLoadingMsg();
    })
    .on('fetch-error', function() {
      $.mobile.hidePageLoadingMsg();
      $.mobile.changePage("#errorPage");
    });
  
  // create the view
  new CityGoerPlacesView({ collection: coll, el: $('#places-list'), template: '#place-template' });  

}

// ## before the follow page, refresh the list
//
$('#follow').live('pagebeforeshow',function(e) {

  var target = $(e.currentTarget);  
  var coll = target.data('collection');
  
  if (!coll) {
    coll = new CityGoerFollowCollection();
    new CityGoerPlacesView({ collection: coll, el: $('#follow-list'), template: '#here-template' });
  }
  else {    
    // refresh
    coll.fetch();  
  }
  
});

//---------------------------------------------------------------------------
//
// BACKBONE SUPPORT 
//
//---------------------------------------------------------------------------

// ## Here Model
//
var CityGoerHereModel = Backbone.Model.extend({
  
  urlRoot: cityGoer.options.api + '/here',
  
});

// ## Place Model
//
var CityGoerPlaceModel = Backbone.Model.extend({
  
  // whatever!
 
});

// ## Follow Collection
//
var CityGoerFollowCollection = Backbone.Collection.extend({
  
  model : CityGoerPlaceModel,
  url   : cityGoer.options.api + '/follow'
  
});

// ## Places Collection
//
var CityGoerPlacesCollection = Backbone.Collection.extend({
  
  model: CityGoerPlaceModel,
  
  sync: function(method, model, options) {  
    var near = this.near || {}; // TODO provide default coords
    var placeType = this.placeType || "*";
    options.data = { lat: near.lat, lon: near.lon, type: placeType };
    return Backbone.sync(method, model, options);  
  },

  url : function() {
    //var near = this.near || {}; // TODO provide default coords
    //var placeType = this.placeType || "*";
    //return cityGoer.options.api + '/near?lat=' + near.lat + '&lon=' + near.lon + '&type=' + placeType;
    return cityGoer.options.api + '/near';
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
    //
    var template        = this.options.template;
    var templateText    = $(template).text();
    
    // format some things...
    var json = this.model.toJSON();
    if (json.taglist)
      json.taglistString = json.taglist.join(', ');
    
    // create HTML
    var placeEl = $(Mustache.render(templateText, json));
    $(this.el).append(placeEl);
    
    // set model as el data
    placeEl.data('model', this.model);
  
    return this;
  },
});

// ## Places View
//
var CityGoerPlacesView = Backbone.View.extend({

  // ### render the collection
  //
  render: function() {
  
    var view = this;
    
    console.log('rendering places collection');
    var parent = $(this.el);
    parent.html('');
    
    this.collection.each(function(model) {
      
      // create new element
      var child = $('<li>');
      
      // create view for model  
      var placeView = new CityGoerPlaceView({el: child, model: model, template: view.options.template});
      placeView.render();
      
      // insert elements
      parent.append(child);
      
    });
    
    // refresh any new widgets
    //$('#places-list').trigger('refresh'); // NOTE DO NOT USE!
    parent.listview('refresh');
    return this;
  },  
  
  // ### init the collection view
  //
  initialize: function() {
    
    // get the associated collection
    var coll = this.collection;    
    if (null !== coll) {
    
      // bind the reset event after the collection is retrieved
      coll.on("reset", function(data) {  
        this.render();
      }, this);
    
      // fetch from the server
      coll.trigger("loading");   
      coll.fetch({
        error: function(collection, response) {
          coll.trigger('fetch-error');
        }
      });
    }
  }
  
});
