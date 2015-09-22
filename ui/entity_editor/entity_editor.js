var topElement;
$(document).on('stonehearthReady', function(){
   topElement = $(top);
   App.debugDock.addToDock(App.StonehearthEntityEditorIcon);
});

App.StonehearthEntityEditorIcon = App.View.extend({
   templateName: 'entityEditorIcon',
   classNames: ['debugDockIcon'],

   didInsertElement: function() {
      $('#entityEditorIcon').tooltipster();
      this.$().click(function() {
         App.debugView.addView(App.StonehearthEntityEditorView);
      })
   }

});

App.StonehearthEntityEditorView = App.View.extend({
   templateName: 'entityEditor',
   uriProperty: 'model',
   components: {
      "mob" :{},
      "destination": {},
      "region_collision_shape": {}
   },

   axis_alignment_flags: {
      'X': 1,
      'Y': 2,
      'Z': 4
   },

   adjacency_flags: {
      'FRONT' : 1 << 0,
      'LEFT' : 1 << 2,
      'BACK' : 1 << 3,
      'RIGHT' : 1 << 4,
      'FRONT_LEFT' : 1 << 5,
      'FRONT_RIGHT' : 1 << 6,
      'BACK_LEFT' : 1 << 7,
      'BACK_RIGHT' : 1 << 8,
   },

   didInsertElement: function() {
      var self = this;
            // for some reason $(top) here isn't [ Window ] like everywhere else.  Why?  Dunno.
      // So annoying!  Use the cached value of $(top) we got in 'stonehearthReady'
      topElement.on("radiant_selection_changed.object_browser", function (_, data) {
         var uri = data.selected_entity;
         if (uri) {
            self.set('uri', uri)
         }
      });

      var selected = App.stonehearthClient.getSelectedEntity();
      if (selected) {
         self.set('uri', selected)
      }

      $('h3').tooltipster();
      $('.has_tooltip').tooltipster();
      self.$().draggable();
   },

   _updateAxisAlignmentFlags: function() {
      var self = this;
      var flag = self.get('model.mob.axis_alignment_flags');
      if (flag & self.axis_alignment_flags['X']) {
         self.set('axis_aligned_x', true);
      } else {
         self.set('axis_aligned_x', false);
      }
      if (flag & self.axis_alignment_flags['Z']) {
         self.set('axis_aligned_z', true);
      } else {
         self.set('axis_aligned_z', false);
      }
   }.observes('model.mob.axis_alignment_flags'),

   _updateAdjacencyFlags: function() {
      var self = this;
      var flag = self.get('model.destination.adjacency_flags');
      radiant.each(self.adjacency_flags, function(flag_name, flag_value) {
         self.set('adjacency_' + flag_name.toLowerCase(), (flag & flag_value) ? true : false);
      });

      $(".checkbox_adjacency").tooltipster();
   }.observes('model.destination.adjacency_flags'),

   _showHideDestination: function() {
      if (this.get('model.destination')) {
         $('#destination').show();
      } else {
         $('#destination').hide();
      }
   }.observes('model.destination'),

   _showHideCollision: function() {
      if (this.get('model.region_collision_shape')) {
         $('#collision').show();
      } else {
         $('#collision').hide();
      }
   }.observes('model.region_collision_shape'),

   _getAdjacencyFlags: function() {
      var self = this;
      var flag = 0;
      radiant.each(self.adjacency_flags, function(flag_name, flag_value) {
         var set = $('#checkbox_adjacency_' + flag_name.toLowerCase()).is(':checked');
         if (set) {
            flag = flag | flag_value;
         }
      });

      return flag;
   },

   _getXYZ: function( prefix) {
      var x = parseFloat($(prefix + '_x').val());
      var y = parseFloat($(prefix + '_y').val());
      var z = parseFloat($(prefix + '_z').val());
      return {x:x, y: y, z:z};
   },

   _getRegions: function(regionName) {
      var regionViews = this.get('childViews');
      var allRegions = [];
      radiant.each(regionViews, function(name, regionView) {
         var destinationRegion = regionView.$(regionName);
         if (destinationRegion && destinationRegion.length > 0) {
            var min = regionView.getRegionMin();
            var max = regionView.getRegionMax();
            allRegions.push({min: min, max: max});
         }
      })
      return allRegions;
   },

   _getUpdates: function() {
      var self = this;
      var updates = {};

      // MOB Updates
      var mobUpdates = {};
      var axisAlignedX = $('#axis_alignment_x').is(':checked') ? self.axis_alignment_flags['X'] : 0;
      var axisAlignedZ = $('#axis_alignment_z').is(':checked') ? self.axis_alignment_flags['Z'] : 0;
      var flags = axisAlignedX | axisAlignedZ;
      mobUpdates['axis_alignment_flags'] = flags;

      // Model Origin
      mobUpdates['model_origin_updates'] = self._getXYZ('#model_origin');
      mobUpdates['region_origin_updates'] = self._getXYZ('#region_origin');
      updates['mob'] = mobUpdates;

      if (self.get('model.destination')) {
         var destinationUpdates = {};
         if (self.get('model.destination.region')) {
            destinationUpdates['region_updates'] = self._getRegions('.destinationRegion');
         }
         destinationUpdates['adjacency_flags'] = self._getAdjacencyFlags();
         updates['destination'] = destinationUpdates;
      }

      if (self.get('model.region_collision_shape')) {
         var collisionUpdates = {};
         if (self.get('model.region_collision_shape.region')) {
            collisionUpdates['region_updates'] = self._getRegions('.collisionRegion');
         }
         updates['region_collision_shape'] = collisionUpdates;
      }

      return updates;
   },

   actions: {
      close: function () {
         this.destroy();
      },
      updateEntity: function () {
         var self = this;
         return radiant.call('debugtools:update_entity_command', self.get('uri'), self._getUpdates()); 
      },
      addDestinationRegion: function () {
         var self = this;
         var updates = {};
         var destinationUpdates = {};
         var regions = self._getRegions('.destinationRegion');
         var existing_region = regions[regions.length - 1];
         var newMin = {x:existing_region.max.x, y:0, z: existing_region.max.z};
         var newMax = {x:existing_region.max.x + 1, y:1, z: existing_region.max.z + 1};
         regions.push({min: newMin, max: newMax});
         destinationUpdates['region_updates'] = regions;
         updates['destination'] = destinationUpdates;
         return radiant.call('debugtools:update_entity_command', self.get('uri'), updates); 
      },
      addCollisionRegion: function () {
         var self = this;
         var updates = {};
         var collisionUpdates = {};
         var regions = self._getRegions('.collisionRegion');
         var existing_region = regions[regions.length - 1];
         var newMin = {x:existing_region.max.x, y:0, z: existing_region.max.z};
         var newMax = {x:existing_region.max.x + 1, y:1, z: existing_region.max.z + 1};
         regions.push({min: newMin, max: newMax});
         collisionUpdates['region_updates'] = regions;
         updates['region_collision_shape'] = collisionUpdates;
         return radiant.call('debugtools:update_entity_command', self.get('uri'), updates); 
      }
   },

   destroy: function() {
      topElement.off("radiant_selection_changed.object_browser");
      this._super();
   },

});

App.DebugToolsRegionItemView = App.View.extend({
   classNames: ['regionItem'],

   components: {
   },

   didInsertElement: function() {
      var self = this;
      $('.has_tooltip').tooltipster();
   },

   _getXYZ: function(prefix) {
      var x = parseFloat(this.$(prefix + '_x').val());
      var y = parseFloat(this.$(prefix + '_y').val());
      var z = parseFloat(this.$(prefix + '_z').val());
      return {x:x, y: y, z:z};
   },

   getRegionMin: function() {
      return this._getXYZ('#region_min');
   },

   getRegionMax: function() {
      return this._getXYZ('#region_max');
   }

});