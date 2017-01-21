
App.StonehearthEntityTrackerInspectorView = App.View.extend({
   templateName: 'entityTrackerInspector',
   uriProperty: 'model',
   closeOnEsc: true,
   
   init: function() {
      var self = this;
      self._isAsc = false;
      self._setSortFunction('count', self._isAsc);
      radiant.call_obj('debugtools.entity_tracker', 'load_entities_command')
         .done(function(response) {
               self.set('uri', response.tracker);
               self.set('num_entities', response.num_entities)
            });
      self._super();
   },

   didInsertElement: function() {
      var self = this;
      self.$().draggable();
      // look at entities
      self.$('#body').on("click", ".navlink", function(event) {
         var uri = $(this).attr('href');
         var existingDebugView = App.debugView.getView(App.StonehearthObjectBrowserView);
         App.debugView.addView(App.StonehearthObjectBrowserView, { uri: uri });
      });

      self.$('#countHeader').click(function(event) {
         self._isAsc = !self._isAsc;
         self._setSortFunction('count', self._isAsc);
         self._updateAllEntities();
      });

      self.$('#AliasHeader').click(function(event) {
         self._isAsc = !self._isAsc;
         self._setSortFunction('uri', self._isAsc);
         self._updateAllEntities();
      });

      self.$('#refreshIcon').click(function(event) {
         self._updateAllEntities();
      });

      self.$('#uriInput').focus(function(e) {
         $(self).val('');
      });

      self.$('#uriInput').keypress(function(e) {
         if (e.which == 13) { // return
            var uri = self.$('#uriInput').val();
            self._updateAllEntities(uri);
         }
      });
   },

   _setSortFunction: function(sort_field, isAsc) {
      this._sort = function(array) {
         array.sort(function(a, b){
            var a_value = a[sort_field];
            var b_value = b[sort_field];
            if ((typeof a_value) == 'string') {
               return isAsc ? a_value.localeCompare(b_value) : b_value.localeCompare(a_value);
            }
            return isAsc ? (a_value - b_value) : (b_value - a_value);
         });
      };
      var suffix = isAsc ? 'asc' : 'desc';
      this.set('sort', {});
      this.set('sort.' + sort_field + '_' + suffix, true);
   },

   _updateAllEntities: function(key) {
      var self = this;
      var entities_dictionary = self.get('model.entities');
      var entities_array = [];
      var index = 0;
      radiant.each(entities_dictionary, function(k, v) {
         var uri = k;
         if (uri == "") {
            uri = "[no uri]"
         }
         var addToArray = false;
         if (typeof key != "string" || (key && (key != "") && (uri.indexOf(key) != -1))) {
            entities_array[index] = {
               count : v.count,
               uri : uri,
               data : v.data
            };
            index++;
         }
      });

      self._sort(entities_array);
      self.set('all_entities', entities_array);
   }.observes('model.entities'),

   out_of_bounds_entities: function() {
      var self = this;
      var entities_array = radiant.map_to_array(self.get('model.out_of_bounds_entities'));
      return entities_array;
   }.property('model.out_of_bounds_entities'),

   actions: {
      refresh: function() {
         this._updateAllEntities();
      },
      search: function() {
         var uri = this.$('#uriInput').val();
         this._updateAllEntities(uri);
      },
      close: function () {
         this.destroy();
      },
   }
});