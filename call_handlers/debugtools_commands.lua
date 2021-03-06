local Point3 = _radiant.csg.Point3
local InterruptAi = require 'mixintos.interrupt_ai.interrupt_ai'
local entity_forms_lib = require 'stonehearth.lib.entity_forms.entity_forms_lib'

local Commands = class()

function Commands:interrupt_ai(session, response, entity)
   stonehearth.ai:add_custom_action(entity, InterruptAi)
   radiant.events.listen(entity, 'debugtools:ai_interrupted', function()
         stonehearth.ai:remove_custom_action(entity, InterruptAi)
         return radiant.events.UNLISTEN
      end)
end

function Commands:create_and_place_entity(session, response, uri, iconic, timesNine)
   local entity = radiant.entities.create_entity(uri)
   local entity_forms = entity:get_component('stonehearth:entity_forms')

   if iconic and entity_forms ~= nil then
      entity = entity_forms:get_iconic_entity()
   end

   stonehearth.selection:deactivate_all_tools()
   stonehearth.selection:select_location()
      :set_cursor_entity(entity)
      :done(function(selector, location, rotation)
               if timesNine == true then
                  for x=-1,1 do
                     for z=-1,1 do
                        --leave the center one (+0,0) to the call outside the loop, so that it can clean up the entity
                        if x~=0 or z~=0 then
                           _radiant.call('debugtools:create_entity', uri, iconic, location + Point3(x,0,z), rotation)
                        end
                     end
                  end
               end

               _radiant.call('debugtools:create_entity', uri, iconic, location, rotation)
                  :done(function()
                     radiant.entities.destroy_entity(entity)
                     response:resolve(true)
                  end)
            end)
      :fail(function(selector)
            selector:destroy()
            response:reject('no location')
         end)
      :always(function()
         end)
      :go()
end

function Commands:create_entity(session, response, uri, iconic, location, rotation)
   local entity = radiant.entities.create_entity(uri, { owner = session.player_id })
   local entity_forms = entity:get_component('stonehearth:entity_forms')

   if entity_forms == nil then
      iconic = false
   end

   radiant.terrain.place_entity(entity, location, { force_iconic = iconic })
   radiant.entities.turn_to(entity, rotation)
   local inventory = stonehearth.inventory:get_inventory(session.player_id)
   if inventory and not inventory:contains_item(entity) then
      inventory:add_item(entity)
   end

   return true
end

function Commands:destroy_npc_stockpiles(session, response, npc_player_id)
   if npc_player_id then
      return self:_destroy_player_stockpiles(npc_player_id)
   end
   local npcs = radiant.resources.load_json('stonehearth:data:npc_index')
   if npcs then
      for player_id, info in pairs(npcs) do
         self:_destroy_player_stockpiles(player_id)
      end
   end
   return true
end

function Commands:_destroy_player_stockpiles(player_id)
   local inventory = stonehearth.inventory:get_inventory(player_id)
   local stockpiles = inventory and inventory:get_all_stockpiles()
   if not stockpiles then
      return false
   end
   for id, entity in pairs(stockpiles) do
      radiant.entities.kill_entity(entity)
   end
   return true
end

function Commands:add_exp_command(session, response, entity, exp)
   local job_component = entity:get_component('stonehearth:job')
   if not job_component then
      return false
   end
   if not exp and not job_component:is_max_level() then
      job_component:level_up()
   else
      job_component:add_exp(exp)
   end
   return true
end

function Commands:set_expendable_resource_command(session, response, entity, resource, value)
   local erc = entity:get_component('stonehearth:expendable_resources')
   if not erc then
      return false
   end

   erc:set_value(resource, value)
   return true
end

function Commands:set_expendable_resource_to_all_citizens_command(session, response, resource, value)
   local town = stonehearth.town:get_town(session.player_id)
   if town then
      local citizens = town:get_citizens()
      if citizens then
         for _, citizen in citizens:each() do
            self:set_expendable_resource_command(session, response, citizen, resource, value)
         end
      end
      return true
   end
   return false
end


function Commands:set_attr_command(session, response, entity, attribute, value)
   local attribute_component = entity:get_component('stonehearth:attributes')
   if not attribute_component then
      return false
   end
   if attribute == 'health' or attribute == 'guts' then
      -- special case health because it's not actually an attribute
      radiant.entities.set_resource(entity, attribute, value)
      return true
   end

   attribute_component:set_attribute(attribute, value)
   return true
end

function Commands:get_score_command(session, response, score_type)
   local scores = stonehearth.score:get_scores_for_player(session.player_id):get_score_data()
   local score = scores and scores.total_scores:get(score_type) or 0

   response:resolve({score = score})
end

function Commands:set_attr_to_all_citizens_command(session, response, attribute, value)
   local town = stonehearth.town:get_town(session.player_id)
   if town then
      local citizens = town:get_citizens()
      if citizens then
         for _, citizen in citizens:each() do
            local attribute_component = citizen:get_component('stonehearth:attributes')
            attribute_component:set_attribute(attribute, value)
         end
      end
      return true
   end
   return false
end

function Commands:set_game_speed_command(session, response, value)
   local default_speed = stonehearth.game_speed:get_default_speed() or 1
   local game_speed = stonehearth.game_speed
   return game_speed:set_game_speed(default_speed * value, true)
end

function Commands:reset_location_command(session, response, entity, x, y, z)
   local location = radiant.entities.get_world_grid_location(entity)
   if x and y and z then
      location = Point3(x, y, z)
   end

   local placement_point = radiant.terrain.find_placement_point(location, 1, 4)
   radiant.terrain.place_entity(entity, placement_point)
   return true
end

function Commands:change_score_command(session, response, entity, scoreName, value)
   local score_component = entity:get_component('stonehearth:score')
   if not score_component then
      return false
   end
   if score_component:get_score(scoreName) == nil then
      return false
   end

   score_component:change_score(scoreName, value)
   return true
end

function Commands:reset_scores_command(session, response, entity)
   local score_component = entity:get_component('stonehearth:score')
   if not score_component then
      return false
   end
   score_component:reset_all_scores()
   return true
end

function Commands:add_buff_command(session, response, entity, buff_uri)
   radiant.entities.add_buff(entity, buff_uri)
   return true
end

function Commands:remove_buff_command(session, response, entity, buff_name)
   if entity and entity:is_valid() then
      local buff_component = entity:get_component('stonehearth:buffs')
      if buff_component then
         buff_component:remove_buff(buff_name, true) -- True for removing all refs for the buff
         return true
      end
   end
   return false
end

function Commands:add_thought_command(session, response, entity, thought_key)
   local thoughts_component = entity:get_component('stonehearth:thoughts')
   if thoughts_component then
      radiant.entities.add_thought(entity, thought_key)
      return true
   end
   return false
end

function Commands:remove_thought_command(session, response, entity, thought_key)
   radiant.entities.remove_thought(entity, thought_key)
   return true
end

function Commands:set_happiness_command(session, response, entity, value)
   local happiness_component = entity:get_component('stonehearth:happiness')
   if happiness_component then
      happiness_component:debug_set_happiness(value)
   end
end

function Commands:add_trait_command(session, response, entity, trait, args)
   radiant.entities.add_trait(entity, trait, args)
   return true
end

function Commands:remove_trait_command(session, response, entity, trait)
   radiant.entities.remove_trait(entity, trait)
   return true
end

function Commands:promote_to_command(session, response, entity, job, desired_level)
   if not job then
      response:reject('Failed: No job name provided.')
      return 
   end

   if not string.find(job, ':') and not string.find(job, '/') then
      -- as a convenience for autotest writers, stick the stonehearth:job on
      -- there if they didn't put it there to begin with
      job = 'stonehearth:jobs:' .. job
   end

   --radiant.entities.drop_carrying_on_ground(entity) 
   local job_component = entity:get_component('stonehearth:job')
   if(job_component) then

      local skip_visual_effects = (desired_level and desired_level > 1) --if a level was provided, assume that will pop a dialog instead
      job_component:promote_to(job, {skip_visual_effects=skip_visual_effects})  --skipping visual effects also skips the "X became a Y!" announcement

      if desired_level then
         local current_level = job_component:get_current_job_level()
         local num_levelups_required = desired_level - current_level;

         --condition starts false if we're already at/above desired level
         for i=1, num_levelups_required do
            local hide_effects = (i ~= num_levelups_required) --only show effects and announcement for final levelup. true = hide effects for some reason
            job_component:level_up(hide_effects) 
         end
      end
   else
      response:reject('Failed: Selected entity has no job data: ' .. tostring(entity))
      return 
   end

   return true
end

function Commands:add_citizen_command(session, response, job, desired_level)
   local player_id = session.player_id
   local pop = stonehearth.population:get_population(player_id)
   local citizen = pop:create_new_citizen()

   if not job then
      job = 'worker'
   end

   Commands:promote_to_command(session, response, citizen, job, desired_level)

   local explored_region = stonehearth.terrain:get_visible_region(player_id):get()
   local centroid = explored_region:get_centroid():to_closest_int()
   local town_center = radiant.terrain.get_point_on_terrain(Point3(centroid.x, 0, centroid.y))

   local spawn_point = radiant.terrain.find_placement_point(town_center, 20, 30)
   radiant.terrain.place_entity(citizen, spawn_point)

   return true
end

function Commands:add_gold_console_command(session, response, gold_amount)
   local inventory = stonehearth.inventory:get_inventory(session.player_id)

   if inventory == nil then
      response:reject('there is no inventory for player ' .. session.player_id)
      return
   end

   if (gold_amount > 0) then
      -- give gold to the player
      inventory:add_gold(gold_amount)
   else
      -- deduct gold from the player
      gold_amount = -gold_amount;
      inventory:subtract_gold(gold_amount)
   end
   response:resolve({'added gold chests next to town banner'})
end

function Commands:dump_backpack_command(session, response, entity)
   local storage = entity:get_component('stonehearth:storage')

   if not storage then
      return false
   end

   storage:_on_kill_event()
   return true
end

function Commands:hot_reload_server(session, response, entity)
   radiant.resources.reset()
   return true
end

function Commands:hot_reload_client(session, response, entity)
   radiant.resources.reset()
   return true
end

function Commands:add_journal_command(session, response, entity, journal_type)
   if journal_type then
      local substitution_values = {}
      substitution_values['gather_target'] = 'i18n(stonehearth:entities.food.berries.berry_basket.display_name)'
      local score_metadata = {score_name = 'debug', score_mod = 1}
      local journal_data = {entity = entity, description = journal_type, probability_override = 100, substitutions = substitution_values}
      stonehearth.personality:log_journal_entry(journal_data, score_metadata)
      response:resolve({})
   else
      local activity_logs = stonehearth.personality._activity_logs
      local available_activities = {}
      for activity_name, _ in pairs(activity_logs) do
         table.insert(available_activities, activity_name)
      end
      response:resolve({error='must specify journal type', available_activities = available_activities})
   end
end

function Commands:pasture_reproduce_command(session, response, entity)
   local pasture = entity:get_component('stonehearth:shepherd_pasture')

   if not pasture then
      return false
   end

   return pasture:_reproduce()
end

function Commands:renew_resource_command(session, response, entity)
   local renewable_resource_component = entity:get_component('stonehearth:renewable_resource_node')

   if not renewable_resource_component then
      return false
   end

   renewable_resource_component:renew()
   return true
end

function Commands:grow_command(session, response, entity)
   local evolve_component = entity:get_component('stonehearth:evolve')
   if evolve_component then
      evolve_component:evolve()
      return true
   end

   local growing_component = entity:get_component('stonehearth:growing')
   if growing_component then
      growing_component:_grow()
      return true
   end

   return false
end

function Commands:get_all_item_uris_command(session, response)
   local uri_map = stonehearth.catalog:get_all_entity_uris()
   local uri_table = {}

   for uri in pairs(uri_map) do
      table.insert(uri_table, uri)
   end

   return uri_table
end

function Commands:decay_command(session, response, entity)
   return stonehearth.food_decay:debug_decay_to_next_stage(entity)
end

function Commands:start_game_master_command(session, response, entity)
   stonehearth.game_master:start()
   return true
end

function Commands:get_mod_controller_command(session, response, mod_name)
   local mod_data = _G[mod_name]
   if mod_data then
      response:resolve({mod_uri=mod_data.__saved_variables})
   end
   response:resolve({})
end

function Commands:get_all_data(session, response, game_object)
   local data = {}
   if not game_object then
      response:reject('unknown game object')
      return
   end
   if type(game_object.get_data) == 'function' then
      data = game_object:get_data()
   elseif type(game_object.__saved_variables) == 'userdata' then
      -- non-SvTable controllers, will just have a __saved_variables block shoved
      -- in there.  Grab that one's data.
      data = game_object.__saved_variables:get_data()
   else
      response:reject('could not find get_data method on ' .. tostring(game_object))
      return
   end
   response:resolve(data)
end

function Commands:call_component_function_command(session, response, entity, component_name, function_name, ...)
   if not entity then
      response:reject('unknown entity')
      return
   end

   local component = entity:get_component(component_name)
   if not component then
      response:reject('no component '..component_name..' on entity.')
      return
   end

   local function_ptr = component[function_name]
   if not function_ptr or type(function_ptr) ~= 'function' then
      response:reject(function_name..' is not a function')
      return
   end

   local data = function_ptr(component, ...)

   response:resolve(data)
end

function Commands:ai_reconsider_entity_command(session, response, entity)
   stonehearth.ai:reconsider_entity(entity, 'debugtools reconsider')

   return true
end

function Commands:fill_storage_command(session, response, entity, uri)
   if not entity then
      response:reject('unknown entity')
      return
   end

   local storage_component = entity:get_component('stonehearth:storage')
   if not storage_component then
      response:reject('entity is not storage')
      return
   end

   local add_to_storage = function(storage, item_uri)
      local item = radiant.entities.create_entity(item_uri, {owner = entity})
      local root, iconic = entity_forms_lib.get_forms(item)
      if iconic then
         storage:add_item(iconic)
      else
         storage:add_item(item)
      end
   end

   local num = storage_component:get_capacity() - storage_component:get_num_items()

   for i=1, num do
      add_to_storage(storage_component, uri)
   end

   return true
end

function Commands:set_ai_log_override_command(session, response, level, entity)
   if entity and entity:is_valid() then
      if level > 1 then
         _radiant.ai.set_entity_log_level_override(entity:get_id())
      else
         _radiant.ai.set_entity_log_level_override(0) -- if no entity, clear out the entity ID stuff.
      end
   else
      _radiant.ai.set_entity_log_level_override(0) -- if no entity, clear out the entity ID stuff.
      _radiant.ai.set_log_level_override(level)
   end
   response:resolve({level = level})
end

function Commands:get_gamestate_now_command(session, response)
   local now = radiant.gamestate.now()
   response:resolve({now = now})
end

function Commands:spawn_encounter_command(session, response, campaign_name, encounter_name, arc, args)
   local options = {
      campaign_name = campaign_name,
      encounter_name = encounter_name,
      arc = arc,
      override_info = args
   }

   stonehearth.game_master:get_game_master(session.player_id):set_ignore_start_requirements(true)
   stonehearth.game_master:get_game_master(session.player_id):debug_trigger_campaign_encounter(options)
   stonehearth.game_master:get_game_master(session.player_id):set_ignore_start_requirements(false)
   response:resolve({})

end

function Commands:fixup_components_command(session, response, entity)
   if not entity then
      response:reject('unknown entity')
      return
   end
   local uri = entity:get_uri()
   local json = radiant.resources.load_json(uri)
   if not json then
      response:reject('uri '..uri..' has no json')
      return
   end

   local components = json.components or {}
   local added_components = {}
   for component_name, _ in pairs(components) do
      if not entity:get_component(component_name) then
         entity:add_component(component_name)
         table.insert(added_components, component_name)
      end
   end

   response:resolve({added_components = added_components})
end

function Commands:get_current_interaction_command(session, response, entity)
   local social_component = entity:get_component('stonehearth:social')
   if not social_component then
      response:reject('entity does not have social component')
   end
   return { data = social_component:get_current_interaction_target() or '' }
end

function Commands:select_storage_command(session, response, entity)
   if not radiant.entities.is_entity(entity) then
      response:reject('unknown entity')
      return
   end

   local inventory = stonehearth.inventory:get_inventory(session.player_id)
   if not inventory then
      response:reject('no inventory for requester')
      return
   end

   local container = inventory:container_for(entity)
   if not container then
      response:reject('entity has no container')
      return
   end

   response:resolve({container = container})
end

local PROFILER_ENABLED = false
local PROFILER_LONG_TICKS = false
function Commands:toggle_profiler(session, response, long_ticks)
   if PROFILER_ENABLED then
      PROFILER_ENABLED = false
   else
      PROFILER_ENABLED = true
      PROFILER_LONG_TICKS = long_ticks
   end

   if PROFILER_LONG_TICKS then
      _radiant.call('radiant:toggle_profile_long_ticks')
   else
      _radiant.call('radiant:toggle_cpu_profile')
   end

   response:resolve({profiler_enabled = PROFILER_ENABLED, long_ticks_only = PROFILER_LONG_TICKS})
end

-- A hack, but since we don't keep track of the max_profile_length
-- allow perfmon to set this manually since it tries to estimate the end time
function Commands:on_profiler_disabled(session, response)
   PROFILER_ENABLED = false
   response:resolve({profiler_enabled = PROFILER_ENABLED, long_ticks_only = PROFILER_LONG_TICKS})
end

function Commands:print_ai_stack_command(session, response, entity)
   if not radiant.entities.is_entity(entity) then
      response:reject('unknown entity')
      return
   end

   local ai_component = entity:get_component('stonehearth:ai')
   if not ai_component then
      response:reject('no ai component')
      return
   end

   local thread = ai_component:get_thread()
   if not thread then
      response:reject('no thread')
      return
   end

   local coroutine = thread._co
   if not coroutine then
      response:reject('thread has no coroutine!')
      return
   end

   local trace_back = debug.traceback(coroutine)

   if not trace_back then
      response:reject('no trace back obtained for coroutine')
      return
   end
   _host:report_error("AI Stack", trace_back)
   response:resolve({'reported traceback for entity '..tostring(entity)})
end

function Commands:add_conversation_subject_command(session, response, entity, subject, sentiment_override)
   local conversation_component = entity:get_component('stonehearth:conversation')

   if conversation_component then
      local subject = conversation_component:add_conversation_subject(subject, sentiment_override)
      response:resolve(subject)
   else
      return false
   end
end

function Commands:get_conversation_subject_command(session, response, entity, subject)
   local conversation_component = entity:get_component('stonehearth:conversation')

   if conversation_component then
      local subject = conversation_component:get_conversation_subject(subject)
      response:resolve(subject)
   else
      return false
   end
end

function Commands:get_conversation_actives_command(session, response, entity)
   local subject_matter_component = entity:get_component('stonehearth:subject_matter')

   if subject_matter_component then
      local actives = subject_matter_component:get_actives()
      response:resolve(actives)
   else
      return false
   end
end

function Commands:show_animation_text_command(session, response, bool)
   radiant.util.set_global_config('mods.stonehearth.show_animation_text', bool)
   return true
end

function Commands:exec_script_server(session, response, script, entity)
   return self:exec_script(session, response, script, entity)
end

function Commands:exec_script_client(session, response, script, entity)
   return self:exec_script(session, response, script, entity)
end

function Commands:exec_script(session, response, script, entity)
   local expr, error
   expr, error = loadstring('return ' .. script)
   if not expr then
      -- Maybe it's a statement?
      expr, error = loadstring(script)
   end
   if error then
      response:reject('ERROR: ' .. error)
   end
   
   -- Set the entity as a global variable. This is terrible, but unavoidable if we want to
   -- let executed code set global vars. We could instead compile the expression as a
   -- function with an entity argument, but if it's a statement, it won't be able to
   -- normally set global vars, so no REPL state.
   local saved_entity = rawget(_G, 'e')
   rawset(_G, 'e', entity)
   local success, result = pcall(expr)
   rawset(_G, 'e', saved_entity)

   if success then
      local output
      if result == nil then
         output = '<nil>'
      elseif type(result) == 'string' then
         output = string.gsub(string.format('%q', result), '\n', 'n')
      else
         -- Complex type. See if we can tostring it safely.
         success, output = pcall(function()
               if type(result) == 'table' then
                  return radiant.util.table_tostring(result)
               else
                  return tostring(result)
               end
            end)
         if not success then
            output = '<unformattable object>'
         end
      end
      response:resolve(output)
   else
      response:reject('ERROR: ' .. result)
   end
end

return Commands
