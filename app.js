(function() {

  return {
    // #Events
    events: {
      'app.activated':'loadDefault',
      'click .default':'loadTime',
      'click .cancel_button':'loadDefault'
      //'ticket.custom_field_{{total_time_field_id}}':'loadTime'
    },
    // #Requests
    requests: {
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
      postTicket: function () {
        return {
          url: helpers.fmt('/api/v2/tickets/%@.json',this.ticket().id()),
          type: 'POST',
          // TODO: build this request out
        };
      }
    },
    // #Functions
    loadDefault: function() {
      this.disableFields();
      this.switchTo('default');
    },
    loadTime: function() {
      //pull ticket field data
      var ticket = this.ticket();
      var loggedTime = {
        "total":ticket.customField(this.settings.total_time_field_id),
        "billable":ticket.customField(this.settings.billable_time_field_id),
        "external":ticket.customField(this.settings.external_time_field_id)
      };
      // TODO: switch to show template and display cumulative times and a loading icon where the logs will be
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
      this.switchTo('form');
    },
    // ##Methods
    disableFields: function() {
      _.each([this.totalTimeFieldLabel(), this.billableTimeFieldLabel(), this.externalTimeFieldLabel(), this.dateFieldLabel()], function(f) {
        var field = this.ticketFields(f);
        if (field) {
          field.disable();
          console.log("Hiding field " + field);
        }
      }, this);
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
