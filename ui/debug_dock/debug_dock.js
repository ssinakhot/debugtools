$(document).on('stonehearthReady', function(){
   App.debugDock = App.debugView.addView(App.StonehearthDebugDockView);
});

App.StonehearthDebugDockView = App.ContainerView.extend({
   classNames: ['debugDock'],
   
   init: function() {
      this._super();
      var self = this;

      setInterval(function () {
         if (self.$()) {
            self.$().toggleClass('titanstorm', Boolean($('#titanstorm:visible')[0]));
         }
      }, 300);
   },

   addToDock: function(ctor) {
      this.addView(ctor)
   }

});
