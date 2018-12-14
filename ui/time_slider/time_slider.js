$(document).on('stonehearthReady', function(){
   App.debugDock.addToDock(App.StonehearthTimeSliderIcon);
});

App.StonehearthTimeSliderIcon = App.View.extend({
   templateName: 'timeSliderIcon',
   classNames: ['debugDockIcon'],

   didInsertElement: function() {
      $('#timeSliderIcon').tooltipster();
      this.$().click(function () {
         var view = App.debugView.getView(App.StonehearthTimeSliderView);
         if (view) {
            view.$().toggle();
         } else {
            App.debugView.addView(App.StonehearthTimeSliderView);
         }
      });
      this._super();
   }
});

App.StonehearthTimeSliderView = App.View.extend({
   templateName: 'timeSlider',
   uriProperty: 'model',
   envContainer: Ember.ContainerView.extend(),

   didInsertElement: function() {
      var self = this;

      self.$().draggable({ handle: '.header' });

      self.$("#closeButton").click(() => self.$().hide());

      self.$('.slider').slider({
         value: 0,
         min: 0,
         max: 24,
         step: 1 / 60 / 60,
         slide: function (event, ui) {
            radiant.call('stonehearth:set_time', {
               hour: Math.floor(ui.value % 24),
               minute: Math.floor((ui.value * 60)) % 60,
               second: Math.floor((ui.value * 60 * 60)) % 60
            });
         }
      });

      radiant.call('stonehearth:get_clock_object')
         .done(function (o) {
            self.trace = radiant.trace(o.clock_object)
               .progress(function (date) {
                  self.set('date', date);
                  self.$('.slider').slider('option', 'value', (date.hour % 24) + date.minute / 60 + date.second / 3600);
               })
         });
   }
});
