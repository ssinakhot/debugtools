var topElement;
$(document).on('stonehearthReady', function(){
   topElement = $(top);
   App.debugDock.addToDock(App.StonehearthJobMonitorIcon);
});

App.StonehearthJobMonitorIcon = App.View.extend({
   templateName: 'jobMonitorIcon',
   classNames: ['debugDockIcon'],

   didInsertElement: function() {
      $('#jobMonitorIcon').tooltipster();
      this.$().click(function() {
         if (this._jobMonitorView) {
            this._jobMonitorView.destroy();
         }
         this._jobMonitorView = App.debugView.addView(App.StonehearthJobMonitorView);
      })
   },

   willDestroyElement: function() {
      this.$().off('click');
      this.$().find('.tooltipstered').tooltipster('destroy');

      if (this._jobMonitorView) {
         this._jobMonitorView.destroy();
         this._jobMonitorView = null;
      }

      this._super();
   },

});

App.StonehearthJobMonitorView = App.View.extend({
   templateName: 'jobMonitor',
   uriProperty: 'model',

   X_ORIGIN: 10,
   Y_ORIGIN: 20,

   LARGE_LED_SIZE: 5,
   LARGE_LED_Y_OFFSET: -6,
   LARGE_FONT: '14px consolasregular',
   LARGE_FONT_LINE_SPACING: 12,
   LARGE_TEXT_LEFT_MARGIN: 4,

   SMALL_LED_SIZE: 3,
   SMALL_LED_Y_OFFSET: -5,
   SMALL_FONT: '12px consolasregular',
   SMALL_FONT_LINE_SPACING: 10,
   SMALL_TEXT_LEFT_MARGIN: 4,

   BFS_PATHFINDER_PROGRESS_BAR_LEFT: 350,
   BFS_PATHFINDER_PROGRESS_BAR_RIGHT: 450,
   BFS_PROGRESS_BAR_COLOR: 'rgb(0, 0, 255)',
   BFS_PROGRESS_BAR_BACKGROUND_COLOR: 'rgb(64, 64, 64)',
   ASTAR_PROGRESS_BAR_COLOR: 'rgb(255, 215, 0)',

   IPF_PATHFINDER_PROGRESS_BAR_LEFT: 350,
   IPF_PATHFINDER_PROGRESS_BAR_RIGHT: 450,
   IPF_PROGRESS_BAR_COLOR: 'rgb(0, 0, 255)',
   IPF_PROGRESS_BAR_BACKGROUND_COLOR: 'rgb(64, 64, 64)',

   DEFAULT_TEXT_COLOR: 'rgb(255, 255, 255)',
   INACTIVE_TEXT_COLOR: 'rgb(128, 128, 128)',
   EJS_INDENT_FOR_PATHFINDERS: 80,
   EJS_INDENT_FOR_ACTIVITY: 430, //EJS_INDENT_FOR_PATHFINDERS + BFS_PATHFINDER_PROGRESS_BAR_LEFT
   EJS_Y_MARGIN: 12,
   EJS_ACTIVITY_COLOR: '#93ef26',

   _createCanvas: function() {      
      this._canvas = document.getElementById('jobMonitorCanvas');
      this._canvas.width = 500;
      this._canvas.height = this._canvas.parentNode.clientHeight - 30; // xxx:fudge

      this._ctx = this._canvas.getContext('2d');
      this._ctx.font = this.LARGE_FONT;
      this._ctx.fillStyle = this.DEFAULT_TEXT_COLOR;
      this._ctx.strokeStyle = this.DEFAULT_TEXT_COLOR;
   },

   _clear: function() {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
   },

   _addText: function(x, y, text, color) {
      this._ctx.fillStyle = color;
      this._ctx.fillText(text, x, y);

      if (y > this._canvas.height) {
         this._canvas.height = y + 20;
      }
   },

   _addBox: function(x, y, w, h, color) {
      this._ctx.fillStyle = color;
      this._ctx.fillRect(x, y, w, h);

      if ((y + h) > this._canvas.height) {
         this._canvas.height = y + h + 20;
      }
   },

   _getLedColor: function(obj) {
      var ACTIVE_FADE_COLORS = [
         "rgb(0, 255, 0)",
         "rgb(0, 192, 0)",
         "rgb(0, 128, 0)",
         "rgb(0, 64, 0)",
         "rgb(0, 32, 0)",
      ];
      var STARVED_COLOR = 'rgb(255, 0, 0)';

      if (obj.status != 'active') {
         return undefined;
      }

      var time_diff = this._now - obj.last_ticked
      if (time_diff >= 0 && time_diff < ACTIVE_FADE_COLORS.length) {
         return ACTIVE_FADE_COLORS[time_diff];
      }
      return STARVED_COLOR;
   },

   _drawIPFStats: function(cursor, name, ipf) {
      // Add the box in the left margin showing the activity of the bfs
      var self = this;
      var activeColor = this._getLedColor(ipf);
      var textColor = activeColor ? self.DEFAULT_TEXT_COLOR : self.INACTIVE_TEXT_COLOR;
      if (activeColor) {
         this._addBox(cursor.x, cursor.y + self.SMALL_LED_Y_OFFSET, self.SMALL_LED_SIZE, self.SMALL_LED_SIZE, activeColor);
      }

      // Add the entity text.
      this._ctx.font = self.SMALL_FONT;
      this._addText(cursor.x + self.SMALL_LED_SIZE + self.SMALL_TEXT_LEFT_MARGIN,
                    cursor.y,
                    ipf.id + ': ' + name + ' (pri:' + ipf.priority + ')',
                    textColor);

      // Draw the progress bar.
      var r = Math.min(1.0, ipf.explored_distance / 1024.0);
      var barWidth = self.BFS_PATHFINDER_PROGRESS_BAR_RIGHT - self.BFS_PATHFINDER_PROGRESS_BAR_LEFT;
      var progressWidth = barWidth * r;
      this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                   cursor.y,
                   barWidth,
                   self.SMALL_LED_SIZE,
                   self.BFS_PROGRESS_BAR_BACKGROUND_COLOR);
      this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                   cursor.y,
                   progressWidth,
                   self.SMALL_LED_SIZE,
                   self.BFS_PROGRESS_BAR_COLOR);

      cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;

      if (ipf.metrics && ipf.metrics.status == 'active') {
         this._drawAStarPathfinder(cursor, '  astar: ' + ipf.metrics.name, ipf.metrics);
      }

      var sorted = [];
      radiant.each(bfs.queries, function(id, search) {
         sorted.push({
            description: search.description,
            search: search,
         })
      });
      sorted.sort(function(l, r) {
         if (l.description < r.description) {
            return -1;
         }
         if (l.description > r.description) {
            return 1;
         }
         return 0;
      })

      // Add all the tasks indented under the ejs.
      cursor.x += self.EJS_INDENT_FOR_PATHFINDERS;
      radiant.each(sorted, function(i, o) {
        self._addText(cursor.x + self.SMALL_TEXT_LEFT_MARGIN,
                      cursor.y,
                      '(dsts:' + o.search.count +')' + o.description,
                      textColor);
        cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;
      });
      cursor.x -= self.EJS_INDENT_FOR_PATHFINDERS;

      cursor.y = cursor.y + self.LARGE_FONT_LINE_SPACING;  
   },

   _drawBFSPathfinder: function(cursor, name, bfs) {
      // Add the box in the left margin showing the activity of the bfs
      var self = this;
      var activeColor = this._getLedColor(bfs);
      var textColor = activeColor ? self.DEFAULT_TEXT_COLOR : self.INACTIVE_TEXT_COLOR;
      if (activeColor) {
         this._addBox(cursor.x, cursor.y + self.SMALL_LED_Y_OFFSET, self.SMALL_LED_SIZE, self.SMALL_LED_SIZE, activeColor);
      }

      // Add the entity text.
      this._ctx.font = self.SMALL_FONT;
      this._addText(cursor.x + self.SMALL_LED_SIZE + self.SMALL_TEXT_LEFT_MARGIN,
                    cursor.y,
                    bfs.id + ': ' + name + ' (pri:' + bfs.priority + ')',
                    textColor);

      // Draw the progress bar.
      var r = Math.min(1.0, bfs.explored_distance / bfs.max_travel_distance);
      var barWidth = self.BFS_PATHFINDER_PROGRESS_BAR_RIGHT - self.BFS_PATHFINDER_PROGRESS_BAR_LEFT;
      var progressWidth = barWidth * r;
      this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                   cursor.y,
                   barWidth,
                   self.SMALL_LED_SIZE,
                   BFS_PROGRESS_BAR_BACKGROUND_COLOR);
      this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                   cursor.y,
                   progressWidth,
                   self.SMALL_LED_SIZE,
                   self.BFS_PROGRESS_BAR_COLOR);

      cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;

      if (bfs.metrics && bfs.metrics.status == 'active') {
         this._drawAStarPathfinder(cursor, '  astar: ' + bfs.metrics.name, bfs.metrics);
      }

      var sorted = [];
      radiant.each(bfs.searches, function(id, search) {
         sorted.push({
            description: search.description,
            search: search,
         })
      });
      sorted.sort(function(l, r) {
         if (l.description < r.description) {
            return -1;
         }
         if (l.description > r.description) {
            return 1;
         }
         return 0;
      })

      // Add all the tasks indented under the ejs.
      cursor.x += self.EJS_INDENT_FOR_PATHFINDERS;
      radiant.each(sorted, function(i, o) {
        self._addText(cursor.x + self.SMALL_TEXT_LEFT_MARGIN,
                      cursor.y,
                      '(dsts:' + o.search.count +')' + o.description,
                      textColor);
        cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;
      });
      cursor.x -= self.EJS_INDENT_FOR_PATHFINDERS;

      cursor.y = cursor.y + self.LARGE_FONT_LINE_SPACING;      
   },

   _drawAStarPathfinder: function(cursor, name, astar, ignoreLabel) {
      // Add the entity text.
      var self = this;
      if (!ignoreLabel) {
         this._ctx.font = self.SMALL_FONT;
         this._addText(cursor.x + self.SMALL_LED_SIZE + self.SMALL_TEXT_LEFT_MARGIN,
                       cursor.y,
                       astar.id + ': ' + '(dst:' + astar.dst_group_count + ') ' + name,
                       astar.stats == 'idle' ? self.INACTIVE_TEXT_COLOR : self.DEFAULT_TEXT_COLOR);
         cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;               
      }

      // Draw the progress bar.
      var current = astar.travel_distance;
      var remaining = astar.eta;
      if (remaining >= 0) {
         var r = Math.min(1.0, current / (current + remaining));
         var barWidth = self.BFS_PATHFINDER_PROGRESS_BAR_RIGHT - self.BFS_PATHFINDER_PROGRESS_BAR_LEFT;
         var progressWidth = barWidth * r;
         this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                      cursor.y,
                      barWidth,
                      self.SMALL_LED_SIZE,
                      self.BFS_PROGRESS_BAR_BACKGROUND_COLOR);
         this._addBox(cursor.x + self.BFS_PATHFINDER_PROGRESS_BAR_LEFT,
                      cursor.y,
                      progressWidth,
                      self.SMALL_LED_SIZE,
                      self.ASTAR_PROGRESS_BAR_COLOR);
      }

      cursor.y = cursor.y + self.SMALL_FONT_LINE_SPACING;
   },

   _drawTasklet: function (cursor, name, tasklet) {
      if (tasklet.type == 'bfs') {
         this._drawBFSPathfinder(cursor, name, tasklet);
      } else if (tasklet.type == 'astar') {
         this._drawAStarPathfinder(cursor, name, tasklet);
      } else if (tasklet.type == 'ipf') {
         this._drawIPFStats(cursor, name, tasklet);
      }
   },

   _getAiForEntity : function (uri) {
      var self = this;

      if (this._entityAi[uri]) {
         return this._entityAi[uri];
      }

      if (!this._entityTraces[uri]) {
         this._entityTraces[uri] = true;
         var entityTrace = radiant.trace(uri);
         entityTrace.progress(function(o) {
            entityTrace.destroy();
            self._entityTraces[uri] = radiant.trace(o['stonehearth:ai'])
               .progress(function(ai) {
                  self._entityAi[uri] = ai;
               });
         });
      }
      return undefined;
   },

   _drawEntityJobScheduler: function (cursor, name, ejs) {
      var self = this;

      // Add the box in the left margin showing the activity of the ejs
      var activeColor = this._getLedColor(ejs);
      var textColor = activeColor ? self.DEFAULT_TEXT_COLOR : self.INACTIVE_TEXT_COLOR;
      if (activeColor) {
         this._addBox(cursor.x, cursor.y + self.LARGE_LED_Y_OFFSET, self.LARGE_LED_SIZE, self.LARGE_LED_SIZE, activeColor);
      }

      // Add the entity text.
      var ai = self._getAiForEntity(ejs.entity_uri);
      if (ai) {
         name = name + ' (pri:' + ejs.priority + ' ticks:' + ejs.total_ticks + ' spin:' + ai.spin_count + ')';
      }

      this._ctx.font = self.LARGE_FONT;
      this._addText(cursor.x + self.LARGE_LED_SIZE + self.LARGE_TEXT_LEFT_MARGIN,
                    cursor.y,
                    name,
                    textColor);

      // Say what they're doing...
      if (ejs.entity_uri) {
         var ai = self._getAiForEntity(ejs.entity_uri);
         if (ai) {
            var activity = i18n.t(ai.status_text_key, { data: ai.status_text_data });                  
            this._addText(cursor.x + self.EJS_INDENT_FOR_ACTIVITY,
                          cursor.y,
                          activity,
                          self.EJS_ACTIVITY_COLOR);
         }
      }

      // Sort all the tasklets by name to help with visualization
      var sortedTasklets = [];
      radiant.each(ejs.tasks, function(id, tasklet) {
         sortedTasklets.push({
            name: tasklet.name,
            tasklet: tasklet,
         })
      });
      sortedTasklets.sort(function(l, r) {
         if (l.name < r.name) {
            return -1;
         }
         if (l.name > r.name) {
            return 1;
         }
         return 0;
      })

      // Add all the tasks indented under the ejs.
      cursor.y = cursor.y + self.LARGE_FONT_LINE_SPACING;      
      cursor.x += self.EJS_INDENT_FOR_PATHFINDERS;
      radiant.each(sortedTasklets, function(i, o) {
         self._drawTasklet(cursor, o.name, o.tasklet);
      });
      cursor.x -= self.EJS_INDENT_FOR_PATHFINDERS;
   },

   _drawRoundRobinTasks: function(tasks) {
      var self = this;
      var cursor = { x: self.X_ORIGIN, y: self.Y_ORIGIN + self.EJS_Y_MARGIN }
      var idleTotal = 0;
      radiant.each(tasks, function(id, ejs) {
         var activity;
         var ai = self._getAiForEntity(ejs.entity_uri);
         if (ai) {
            activity = i18n.t(ai.status_text_key, { data: ai.status_text_data });
            if (activity == 'idle') {
               idleTotal = idleTotal + 1;
            }
         }

         var render;
         if (self._selectedEntity) {
            render = ejs.entity_uri == self._selectedEntity;
         } else {
            render = activity == 'idle';
         }
         if (render) {
            self._drawEntityJobScheduler(cursor, ejs.name, ejs);
            cursor.y += self.EJS_Y_MARGIN;
         }
      });
      this._ctx.font = self.LARGE_FONT;
      this._addText(0, self.EJS_Y_MARGIN, 'idle count: ' + idleTotal, 'rgb(255, 0, 0)');
   },

   actions: {
      close: function () {
         this.destroy();
      }
   },

   didInsertElement: function() {
      var self = this;

      this.$().draggable();

      this._entityTraces = {};
      this._entityAi = {}

      this._createCanvas();

      var first = true;

      this.$('#jobMonitor').position({
         my: 'right top',
         at: 'right bottom',
         of: $('#jobMonitorIcon').closest('.debugDock')
      });

      topElement.on("radiant_selection_changed.object_browser", function (_, data) {
         self._selectedEntity = data.selected_entity;
      });

      radiant.call('radiant:get_job_metrics')
               .progress(function(obj) {
                  self._now = obj.now;

                  if (first) {
                     first = false;
                  }
                  self._clear();
                  self._drawRoundRobinTasks(obj.metrics.tasks);
               });

   },
});
