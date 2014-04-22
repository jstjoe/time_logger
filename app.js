(function() {

  return {
    // #Events
    events: {
      'app.activated':'onAppActivated',
      'pane.activated':'onPaneActivated',

      'click .default':'loadTime',
      'click .cancel_button':'onAppActivated',
      'click .log_time':'buildLog',
      'updateTicket.done':'onTicketUpdateSuccess',

      'keyup #input':'onSearchChanged',
      'getOrgsAuto.done':'handleOrgs',
      'click .org':'handleOrgSelection',
      'click .search':'listTickets',
      'click .back':'loadSearch'
    },

    // #Requests
    requests: {
      getOrgsAuto: function (query) {
        return {
          url: helpers.fmt('/api/v2/organizations/autocomplete.json?name=%@', query.string),
          type: 'POST',
          dataType: 'JSON',
          contentType: 'application/JSON',
          proxy_v2: true,
          data: query.payload
        };
      },
      getOrgTickets: function (id, page) {
        return {
          url: helpers.fmt('/api/v2/organizations/%@/tickets.json?page=%@', id, page),
          type: 'GET',
          proxy_v2: true
        };
      },
      getTicketAudits: function (id, page) {
        return {
          url: helpers.fmt('/api/v2/tickets/%@/audits.json?page=%@', id, page),
          type: 'GET'
        };
      },
      updateTicket: function (payload) {
        return {
          url: helpers.fmt('/api/v2/tickets/%@.json',this.ticket().id()),
          type: 'PUT',
          dataType: 'JSON',
          contentType: 'application/JSON',
          proxy_v2: true,
          data: payload
        };
      }
    },

    // #Functions
    onAppActivated: function(data) {
      var currentLocation = this.currentLocation();
      var loadingPage = this.setting('loading_page');
      if (currentLocation == 'ticket_sidebar' && data.firstLoad && !loadingPage) {
        this.disableFields();
        this.switchTo('form');
        this.$('.date').datepicker().datepicker("setDate", new Date());
      } else if (currentLocation == 'ticket_sidebar' && data.firstLoad) {
        this.switchTo('default');
      }
    },
    onPaneActivated: function(data) {
      if(data.firstLoad) {
        this.loadSearch();
      }
    },
    loadSearch: function() {
      this.switchTo('search');
      var daysBack = this.setting('days_back');
      var start_date = new Date(new Date().setDate(new Date().getDate() - daysBack));
      this.$('.start_date').datepicker().datepicker("setDate", start_date);
      this.$('.end_date').datepicker();
      this.$('.end_date').datepicker("setDate", new Date());
    },
    loadTime: function(e) {
      if (e) {e.preventDefault();}
      this.disableFields();
      this.switchTo('form');
      this.$('.date').datepicker().datepicker("setDate", new Date());
    },

    // ##Methods
    disableFields: function() {
      _.each([this.totalTimeFieldLabel(), this.billableTimeFieldLabel(), this.externalTimeFieldLabel()], function(f) {
        var field = this.ticketFields(f);
        if (field) {
          field.disable();
        }
      }, this);
      this.ticketFields(this.dateFieldLabel()).hide();
    },
    buildLog: function() {
      var log = {};
      log.units = parseFloat( this.$("input.time").val(), 10);
      if (this.$("select.external").val() == "external") {
        log.external = true;
        log.external_time = log.units;
      } else {
        log.external = false;
        log.external_time = 0;
      }
      if (this.$("select.billable").val() == "billable") {
        log.billable = true;
        log.billable_time = log.units;
      } else {
        log.billable = false;
        log.billable_time = 0;
      }
      log.date = this.$("input.date").val();
      this.buildUpdate(log);
    },
    buildUpdate: function(log) {
      if(!log.units) {
        services.notify("No time specified. Please fill in the 'Amount of Time' field before submitting.", "error");
        return;
      }
      if(!log.date) {
        services.notify("No date specified. Please fill in the 'Date delivered' field before submitting.", "error");
        return;
      }
      var tkt = this.ticket(),
        id = tkt.id(),
        total_time = ( log.units + parseFloat(tkt.customField(this.totalTimeFieldLabel()) || 0, 10)),
        billable_time = ( log.billable_time + parseFloat(tkt.customField(this.billableTimeFieldLabel()) || 0, 10)),
        external_time = ( log.external_time + parseFloat(tkt.customField(this.externalTimeFieldLabel()) || 0, 10)),
        update = {"ticket": {
          "metadata": {
            "time_logged": true,
            "log_date": log.date
          },
          "custom_fields":[
          {
            "id": this.setting('total_time_field_id'),
            "value": total_time
          },
          {
            "id": this.setting('billable_time_field_id'),
            "value": billable_time
          },
          {
            "id": this.setting('external_time_field_id'),
            "value": external_time
          },
          {
            "id": this.setting('date_field_id'),
            "value": log.date
          }
        ]}
      };
      var payload = JSON.stringify(update);
      this.ajax('updateTicket', payload);
    },
    onTicketUpdateSuccess: function(response) {
      services.notify("Ticket successfully updated with time log. Refresh to see changes.");
      // hide the specified ticket fields?
      _.each([this.totalTimeFieldLabel(), this.billableTimeFieldLabel(), this.externalTimeFieldLabel()], function(f) {
        var field = this.ticketFields(f);
        if (field) {
          field.hide();
        }
      }, this);

      // handle response data, pull specified ticket fields, display in success template
      var updatedTicket = response.ticket;
    },
    //  ##nav bar functions
    onSearchChanged: function() {
      var name = this.$('#input').val();
      if (name.length >= 2) {
        var query = {
          "string":name,
          "payload":"\"{'name': '" + name + "'}\""
        };
        this.ajax('getOrgsAuto',query);
        this.$("span.no_tickets").hide();
      } else {
        //this.$("div.org_results").html("");
      }
    },
    handleOrgs: function (response) {
      var orgs = response.organizations;
      var html = this.renderTemplate('organizations', {
        orgs: orgs
      });
      this.$("div.org_results").html(html);
    },
    handleOrgSelection: function(e) {
      if (e) {e.preventDefault();}
      this.$('.org').hide();
      this.$('.search').removeAttr('disabled');
      var org_id = e.currentTarget.value;
      this.org_name = e.currentTarget.innerHTML;
      this.$('input.search_field').val(org_id);
    },
    getListOfTickets: function(org_id) {

      var tickets = this.paginate({request : 'getOrgTickets',
                              entity  : 'tickets',
                              id      : org_id,
                              page    : 1 });
      tickets.done(_.bind(function(tkts){
        if(tkts.length !== 0) {
          this.getLogsFromTickets(tkts);
        } else {
          this.$('span.loading').hide();
          this.$("span.no_tickets").show();
        }
        
      }, this));
      // this.switchTo('loading');
    },
    getLogsFromTickets: function(tkts) {
      this.ticketsWithLogs = {};
      //loop through each ticket in the array
      var i = 0;
      _.each(tkts, function (tkt) {
        var tkt_id = tkt.id.toString();
        var audits = this.paginate({request : 'getTicketAudits',
                              entity  : 'audits',
                              id      : tkt_id,
                              page    : 1 });
        audits.done(_.bind(function(audits){
          var eventEntries = this.parseAudits(audits),
            sumTotalTime = eventEntries;
          var total_time_entries = _.map(eventEntries, function(entry, key) {
            return entry.total_time;
          });
          var billable_time_entries = _.map(eventEntries, function(entry, key) {
            return entry.billable_time;
          });
          var external_time_entries = _.map(eventEntries, function(entry, key) {
            return entry.external_time;
          });
          var sum_total_time_entries = _.reduce(total_time_entries, function(memo, num){ return memo + num; }, 0);
          var sum_billable_time_entries = _.reduce(billable_time_entries, function(memo, num){ return memo + num; }, 0);
          var sum_external_time_entries = _.reduce(external_time_entries, function(memo, num){ return memo + num; }, 0);
          var sum_non_billable = sum_total_time_entries - sum_billable_time_entries;
          var sum_internal = sum_total_time_entries - sum_external_time_entries;
            //calculate sums and add them to the object below
          if(sum_total_time_entries !== 0) {
            this.ticketsWithLogs[tkt_id] = {
              "entries": eventEntries,
              "sum_total": sum_total_time_entries,
              "sum_billable": sum_billable_time_entries,
              "sum_non_billable": sum_non_billable,
              "sum_external": sum_external_time_entries,
              "sum_internal": sum_internal,
              "id": tkt_id,
              "url": tkt.url
            };
          }
          if(i == tkts.length - 1) {
            var org_totals = {
              "total_time": _.reduce(this.ticketsWithLogs, function(memo, tkt){ return memo + tkt.sum_total; }, 0),
              "billable_time": _.reduce(this.ticketsWithLogs, function(memo, tkt){ return memo + tkt.sum_billable; }, 0),
              "non_billable_time": _.reduce(this.ticketsWithLogs, function(memo, tkt){ return memo + tkt.sum_non_billable; }, 0),
              "external_time": _.reduce(this.ticketsWithLogs, function(memo, tkt){ return memo + tkt.sum_external; }, 0),
              "internal_time": _.reduce(this.ticketsWithLogs, function(memo, tkt){ return memo + tkt.sum_internal; }, 0)
            };
            this.switchTo('results', {
              tickets: this.ticketsWithLogs,
              org_totals: org_totals,
              org_name: this.org_name
            });
          }
          i++;
        }, this));
        

      }.bind(this));
    },
    listTickets: function (tickets) {
      var org_id = this.$('input.search_field').val();
      this.getListOfTickets(org_id);

      this.$('span.loading').show();

    },
    parseAudits: function (audits) {
      var total_time_field = this.setting('total_time_field_id').toString(),
        billable_time_field = this.setting('billable_time_field_id').toString(),
        external_time_field = this.setting('external_time_field_id').toString();

      var getDelta = function(event) {
        var delta = event.value - event.previous_value;
        return delta;
      };

      var total_time_entries = [],
        billable_time_entries = [],
        external_time_entries = [],
        event_entries = [];

      var date_field = this.setting('date_field_id').toString(),
        start_date = Date.parse(this.$('.start_date').val()),
        end_date = Date.parse(this.$('.end_date').val());
      //the stage is set, now iterate over all the audits, grab those in range, and build them into logs  
      _.each(audits, function(audit) {
        var date_field_event = _.filter(audit.events, function(event){ return event.field_name == date_field ;});//_.where(audit.events, {field_name: date_field}),
        var total_time_event = _.filter(audit.events, function(event){ return event.field_name == total_time_field ;}), //_.where(audit.events, {field_name: total_time_field}),
          billable_time_event = _.filter(audit.events, function(event){ return event.field_name == billable_time_field ;}), //_.where(audit.events, {field_name: billable_time_field}),
          external_time_event = _.filter(audit.events, function(event){ return event.field_name == external_time_field ;}); //_.where(audit.events, {field_name: external_time_field});

        if(date_field_event[0] || audit.metadata.custom.time_logged) {
          
          var date_value;
          if(date_field_event[0]) {
            date_value = Date.parse(date_field_event[0].value);
          } else {
            date_value = Date.parse(audit.metadata.custom.log_date);
          }
          if(date_value >= start_date && date_value <= end_date) {
          //IF the date field value in this audit is between the start and end dates...            
            //IF the event exists
            var total_delta,
              billable_delta,
              non_billable_delta,
              external_delta,
              internal_delta;
            if (total_time_event[0]) {
              total_delta = getDelta(total_time_event[0]);
            } else {
              total_delta = 0;
            }
            if (billable_time_event[0]) {
              billable_delta = getDelta(billable_time_event[0]);
            } else {
              billable_delta = 0;
            }
            if (external_time_event[0]) {
              external_delta = getDelta(external_time_event[0]);
            } else {
              external_delta = 0;
            }
            non_billable_delta = total_delta - billable_delta;
            internal_delta = total_delta - external_delta;
            var local = new Date(date_value),
              date_string = local.toLocaleDateString();

            var compound_entry = {
              'total_time': total_delta,
              'billable_time': billable_delta,
              'non_billable_time': non_billable_delta,
              'external_time': external_delta,
              'internal_time': internal_delta,
              'date': date_string,
              'ticket_id': audit.ticket_id
            };
            event_entries.push(compound_entry);
          }

        }

      });
      return event_entries;
      //push event entries from each ticket to an object containing all the tickets in range, and their entries
    },
    

    // ##Helpers
    totalTimeFieldLabel: function() {
      return this.buildFieldLabel(this.setting('total_time_field_id'));
    },
    billableTimeFieldLabel: function() {
      return this.buildFieldLabel(this.setting('billable_time_field_id'));
    },
    externalTimeFieldLabel: function() {
      return this.buildFieldLabel(this.setting('external_time_field_id'));
    },
    dateFieldLabel: function() {
      return this.buildFieldLabel(this.setting('date_field_id'));
    },
    buildFieldLabel: function(id) {
      return helpers.fmt('custom_field_%@', id);
    },
    paginate: function(a) {
      var results = [];
      var initialRequest = this.ajax(a.request, a.id, a.page);
      // create and return a promise chain of requests to subsequent pages
      var allPages = initialRequest.then(function(data){
        results.push(data[a.entity]);
        var nextPages = [];
        var pageCount = Math.ceil(data.count / 100);
        for (; pageCount > 1; --pageCount) {
          nextPages.push(this.ajax(a.request, a.id, pageCount));
        }
        return this.when.apply(this, nextPages).then(function(){
          var entities = _.chain(arguments)
                          .flatten()
                          .filter(function(item){ return (_.isObject(item) && _.has(item, a.entity)); })
                          .map(function(item){ return item[a.entity]; })
                          .value();
          results.push(entities);
        }).then(function(){
          return _.chain(results)
                  .flatten()
                  .compact()
                  .value();
        });
      });
      return allPages;
    }
  };

}());
