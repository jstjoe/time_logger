(function() {

  return {
    // #Events
    events: {
      'app.activated':'loadDefault',
      'click .default':'loadTime',
      'click .cancel_button':'loadDefault',
      'click .log_time':'buildLog',
      'keyup #input':'onSearchChanged',
      'click .search':'getListOfTickets',
      'updateTicket.done':'onTicketUpdateSuccess'
      // 'getTicketAuditsByID.done':'storeAudits',
      // 'getTicketAuditsByPage.done':'storeAudits'
      //'ticket.custom_field_{{total_time_field_id}}':'loadTime'
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
      // getTicket: function () {
      //   //use this only after updating the ticket asynchronously
      //   return {
      //     url: helpers.fmt('/api/v2/tickets/%@.json',this.ticket().id()),
      //     type: 'GET'
      //   };
      // },
      getTicketAudits: function (id, page) {
        return {
          url: helpers.fmt('/api/v2/tickets/%@/audits.json?page=%@', id, page),
          type: 'GET'
        };
      },
      // getTicketAuditsByPage: function (id, page) {
      //   return {
      //     url: helpers.fmt('/api/v2/tickets/%@/audits.json?page=%@', id, page),
      //     type: 'GET'
      //   };
      // },
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
    loadDefault: function() {
      var currentLocation = this.currentLocation();
      console.log("Location: " + currentLocation);
      if (currentLocation == 'ticket_sidebar') {
        this.disableFields();
        this.switchTo('form');
      } else if (currentLocation == 'nav_bar') {
        this.switchTo('search');
        var daysBack = this.setting('days_back');
        this.$('.start_date').datepicker().datepicker("setDate", new Date(new Date().setDate(new Date().getDate() - daysBack)));
        this.$('.end_date').datepicker().datepicker("setDate", new Date());
      }
    },
    loadTime: function() {

      this.switchTo('form');
    },
    // ##Methods
    disableFields: function() {
      _.each([this.totalTimeFieldLabel(), this.billableTimeFieldLabel(), this.externalTimeFieldLabel(), this.dateFieldLabel()], function(f) {
        var field = this.ticketFields(f);
        if (field) {
          field.disable();
          // console.log("Hiding field " + field);
        }
      }, this);
    },
    buildLog: function() {
      var log = {};
      log.units = parseFloat( this.$("input.time").val(), 10);
      if (this.$("select.external").val() == "external") {
        log.external = true;
        log.external_time = log.units;
      } else {
        log.external = false;
        log.internal_time = log.units;
      }
      if (this.$("select.billable").val() == "billable") {
        log.billable = true;
        log.billable_time = log.units;
      } else {
        log.billable = false;
        log.non_billable_time = log.units;
      }
      log.date = this.$("input.date").val();
      this.buildUpdate(log);
    },
    buildUpdate: function(log) {
      var tkt = this.ticket(),
        id = tkt.id(),
        total_time = ( log.units + parseFloat(tkt.customField(this.totalTimeFieldLabel()), 10))|| 0,
        billable_time = ( log.billable_time + parseFloat(tkt.customField(this.billableTimeFieldLabel()), 10))|| 0,
        external_time = ( log.external_time + parseFloat(tkt.customField(this.externalTimeFieldLabel()), 10))|| 0,
        update = {"ticket":
        {"custom_fields":[
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
      console.log(payload);
      this.ajax('updateTicket', payload);
    },

    //  ##nav bar functions
    onSearchChanged: function() {
      var name = this.$('#input').val();
      console.log("Name: " + name);
      if (name.length >= 2) {
        var query = {
          "string":name,
          "payload":"\"{'name': '" + name + "'}\""
        };
        this.ajax('getOrgsAuto',query).done(function(response) {

          //we need to render the organization options and allow the user to select one
        });
      }
    },
    getListOfTickets: function() {
      var org_id = this.$('input.search_field').val();
      //console.log(org_id);
      var tickets = this.paginate({request : 'getOrgTickets',
                              entity  : 'tickets',
                              id      : org_id,
                              page    : 1 });
      tickets.done(_.bind(function(tkts){
        this.getLogsFromTickets(tkts);
      }, this));
    },
    getLogsFromTickets: function(tkts) {
      this.ticketAudits = [];

      //loop through each ticket in the array
      _.each(tkts, function (tkt) {
        this.ajax('getTicketAudits', tkt.id, 1);
        var tkt_id = tkt.id;
        var audits = this.paginate({request : 'getTicketAudits',
                              entity  : 'audits',
                              id      : tkt_id,
                              page    : 1 });
        audits.done(_.bind(function(audits){
          this.parseAudits(audits);
        }, this));
      }.bind(this));

      
    },
    storeAudits: function (data, end) {
      var ticketAudits = data.audits;
      this.ticketAudits = this.ticketAudits.concat(ticketAudits);
      if(data.next_page) {
        this.ajax('getTicketAuditsByPage', data.next_page);
      } else {
        if (end) {
          //end isn't being sent yet
          this.parseAudits();
        }
      }
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
      //console.log(audits);
      //the stage is set, now iterate over all the audits, grab those in range, and build them into logs  
      _.each(audits, function(audit) {
        var date_field_event = _.filter(audit.events, function(event){ return event.field_name === date_field ;}),//_.where(audit.events, {field_name: date_field}),
          date_value = Date.parse(date_field_event.value);
        console.log("Start date: " + start_date);
        console.log("Date value: " + date_value);
        console.log("End date: " + end_date);
        if(date_value >= start_date && date_value <= end_date) {
        //IF the date field value in this audit is between the start and end dates...
          console.log(date_field_event);
          var total_time_event = _.filter(audit.events, function(event){ return event.field_name === total_time_field ;}), //_.where(audit.events, {field_name: total_time_field}),
            billable_time_event = _.filter(audit.events, function(event){ return event.field_name === billable_time_field ;}), //_.where(audit.events, {field_name: billable_time_field}),
            external_time_event = _.filter(audit.events, function(event){ return event.field_name === external_time_field ;}); //_.where(audit.events, {field_name: external_time_field});

          var total_delta = getDelta(total_time_event),
            billable_delta = getDelta(billable_time_event),
            external_delta = getDelta(external_time_event);

          var compound_entry = {
            'total_time': total_delta,
            'billable_time': billable_delta,
            'external_time': external_delta,
            'date': date_value
          };

          console.log(compound_entry);
          total_time_entries.push(total_delta);
          billable_time_entries.push(billable_delta);
          external_time_entries.push(external_delta);
          event_entries.push(compound_entry);
        }
      });
      //console.log(event_entries);
    },
    onTicketUpdateSuccess: function() {
      services.notify("Ticket successfully updated with time log. Refresh to see changes.");
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
