(function() {

  return {
    // #Events
    events: {
      'app.activated':'loadDefault',
      'click .default':'loadTime',
      'click .cancel_button':'loadDefault',
      'click .log_time':'buildLog',
      'click #input':'startAutocomplete',
      'keyup #input':'onSearchChanged'
      //'ticket.custom_field_{{total_time_field_id}}':'loadTime'
    },
    // #Requests
    requests: {
      getOrgsAuto: function (query) {
        return {
          url: helpers.fmt('/api/v2/organizations/autocomplete.json?name=%@',query.string),
          type: 'POST',
          dataType: 'JSON',
          contentType: 'application/JSON',
          proxy_v2: true,
          data: query.payload
        };
      },
      getTicket: function () {
        //use this only after updating the ticket asynchronously
        return {
          url: helpers.fmt('/api/v2/tickets/%@.json',this.ticket().id()),
          type: 'GET'
        };
      },
      getTicketAudits: function () {
        return {
          url: helpers.fmt('/api/v2/tickets/%@/audits.json',this.ticket().id()),
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
    loadDefault: function() {
      var currentLocation = this.currentLocation();
      console.log("Location: " + currentLocation);
      if (currentLocation == 'ticket_sidebar') {
        this.disableFields();
        this.switchTo('form');
      } else if (currentLocation == 'nav_bar') {
        this.startAutocomplete();
        this.switchTo('search');
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
      // console.log("Time: " + log.units);

      if (this.$("select.external").val() == "external") {
        log.external = true;
        log.external_time = log.units;
      } else {
        log.external = false;
        log.internal_time = log.units;
      }
      // console.log("External? " + log.external);
      // console.log("External time: " + log.external_time);
      // console.log("Internal time: " + log.internal_time);

      if (this.$("select.billable").val() == "billable") {
        log.billable = true;
        log.billable_time = log.units;
      } else {
        log.billable = false;
        log.non_billable_time = log.units;
      }
      // console.log("Billable? " + log.billable);
      // console.log("Billable time: " + log.billable_time);
      // console.log("Non-billable time: " + log.non_billable_time);

      log.date = this.$("input.date").val();
      // console.log("Date: " + log.date);
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
    startAutocomplete: function() {
      //fire this whenever someone clicks in the search field
      console.log("startAutocomplete fired!");
      //have it set up an event listener on the search field text input
      
      //if true check the number of characters (min 2)
      //if true fire the getOrgsAuto request with the text formatted as a query
    },
    onSearchChanged: function() {
      var name = this.$('#input').val();
      console.log("Name: " + name);
      if (name.length >= 2) {
        var query = {
          "string":name,
          "payload":"\"{'name': '" + name + "'}\""
        };
        //this scope is whacked
        this.ajax('getOrgsAuto',query);
      }
    },
    getLogsFromTickets: function() {
      var ticket = this.ticket();
      this.ajax('getTicketAudits').done( function (data) {
        //parse ticketAudits into an object, then pass that to the show template
        var ticketAudits = data.audits;
        _.each(ticketAudits, function(audit) {
          _.each(audit.events, function(event){
            // TODO: check events for field_names matching the fields specified in settings
              //...if true: grab the info and generate content from it... 
            console.log(event.field_name);
          });
        });
        //this.switchTo('show', {
        //  ticket:     ticket,
        //  loggedTime: loggedTime,
        //  audits:     ticketAudits
        //});
      });
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
  };

}());
