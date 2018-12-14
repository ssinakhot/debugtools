$(document).on('stonehearthReady', function(){
   App.debugDock.addToDock(App.StonehearthEntityInspectorIcon);
});

// Icon that sits at the top of the screen to open a new entity
// inspector
App.StonehearthEntityInspectorIcon = App.View.extend({
   templateName: 'entityInspectorIcon',
   classNames: ['debugDockIcon'],

   didInsertElement: function() {
      $('#entityInspectorIcon').tooltipster();
      this.$().click(function() {
         App.debugView.addView(App.StonehearthEntityInspectorView);
      })
   }
});

// Gets us from the debug info in the ai component to the first
// execution frame
App.StonehearthAiThreadView = App.View.extend({
   uriProperty: 'model',
});

// Used for all rows in the table.  Indents according to the depth
// in the tree
App.StonehearthAiRowView = App.View.extend({
   uriProperty: 'model',

   _onModelDepthUpdated: function() {
      var depth = this.get('model.depth');
      var styleOverride = 'padding-left: ' + (depth * 6) + 'px';
      this.set('styleOverride', styleOverride);
   }.observes('model.depth'),

   _checkStuff : function() {
      var model = this.get('model')
      if (model && this.get('model.id') == undefined) {
         console.log('model is', this.get('model'));
      }
   }.observes('model').on('init'),

   // Uncomment to observe the models as they go flying by
   _onModelUpdated: function () {
      if (this.get('model.children') && this.$('.collapser')) {
         this.$('.collapser').css({ opacity: this.get('model.children').length ? 1 : 0 });
      }
      self.$('#search').change();
   }.observes('model').on('init'),

   didInsertElement: function () {
      var self = this;
      this._super();
      self.$('.collapser').click(function () {
         var childRows = self.$('.collapser').closest('.row').siblings();
         childRows.toggle();
         $(this).text(childRows.is(':visible') ? '-' : '+');
      });
      self.$('.row').dblclick(function () {
         $('.collapser', this).click();
      });
      self.$('.row').mouseenter(function () {
         $('.row', $(this).siblings()).addClass('hover-child');
      });
      self.$('.row').mouseleave(function () {
         $('.row', $(this).siblings()).removeClass('hover-child');
      });
   },
});

// Execution frame.  Is recursive, so we can't use an inline view
App.StonehearthExecutionFrameView = App.StonehearthAiRowView.extend({
   templateName: 'executionFrame',
   
   // Execution unit.  We just need to collect the action datastore before
   // rendering...
   components: {
      "action": {}
   },

   actions : {
      stepThis: function(evt) {
         var d = this.get('model.pathfinder_data');
         $("#entityInspector").trigger('stepThis', d);
      }
   },
});

// The inspector.  Just call `debug_info` on the ai_component to get the
// root datastore with the debug info in it.
App.StonehearthEntityInspectorView = App.View.extend({
   templateName: 'entityInspector',
   uriProperty: 'model',
   closeOnEsc: true,
   components: {
   },

   init: function() {
      this._super();
      var self = this;
      $(top).on("radiant_selection_changed.entity_inspector", function (_, data) {
         if (!self.get('is_pinned_to_entity')) {
            self.set('uri', data.selected_entity);
         }
     });
   },

   didInsertElement: function() {
      var self = this;
      this._super();
      self.$().draggable();
      var selected = App.stonehearthClient.getSelectedEntity();
      if (selected) {
         self.set('uri', selected)
      }

      $("#entityInspector").on('stepThis', function(evt, data) {
         self.set('pathdata', data);
      });

      self.$('#search').on('input change paste', function () {
         var query = self.$('#search').val().trim().toLowerCase();
         var needles = query.length ? query.split(/\s+/) : [];
         self.$('.row').removeClass('hasSearchResult');
         self.$('.row').each(function () {
            var haystack = $(this).text().toLowerCase();
            var matches = needles.length > 0 && needles.every(function (needle) {
               return haystack.indexOf(needle) >= 0;
            });
            $(this).toggleClass('searchResult', matches);
            if (matches) {
               $(this).parents().children('.row:first-child').addClass('hasSearchResult');
            }
         });
      });
   },

   _updateAiComponent: function() {
      var self = this;
      self.set('model.debug_info', undefined)
      let objectAddress = self.get('model.stonehearth:ai');
      if (objectAddress) {
         radiant.call_obj(objectAddress, 'get_debug_info')
            .done(function(o) {
               self.set('model.debug_info', o.debug_info);
            })
            .fail(function(o) {
               console.log(o);
            });
      }
   }.observes('model.stonehearth:ai'),

   destroy: function() {
      $(top).off("radiant_selection_changed.entity_inspector");
      this._super(); 
   },

   actions: {
      closeWindow: function () {
         this.destroy();
      },

      dumpPathfinder : function() {
         var pathdata = this.get('pathdata');
         if (pathdata) {
            radiant.call('radiant:dump_pathfinder_with_jobid', pathdata.job_id, pathdata.entity_id);
         }
      },

      stepPathfinder: function() {
         var pathdata = this.get('pathdata');
         if (pathdata) {
            radiant.call('radiant:step_path_with_jobid', pathdata.job_id, pathdata.entity_id);
         }
      },

      pinToEntity: function() {
         this.set('is_pinned_to_entity', true);
      },

      unPinn: function() {
         this.set('is_pinned_to_entity', false);
      },

      setLogOverride: function(level) {
         var self = this;
         radiant.call('debugtools:set_ai_log_override_command', level, self.get('uri'))
            .done(function(response) {
               if (response.level && response.level >= 9) {
                  self.set('is_logging_overridden', true);
               } else {
                  self.set('is_logging_overridden', false);
               }
            });
      }
   },
});
