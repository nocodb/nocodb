import { CustomTransportStrategy, Server } from '@nestjs/microservices';
// import * as AWS from 'aws-sdk';

import  kcl from 'aws-kcl';
import util from 'util';


export default class KinesisConsumerServer
  extends Server
  implements CustomTransportStrategy
{
  // private kinesis: AWS.Kinesis;

  constructor() {
    super();
    // this.kinesis = new AWS.Kinesis({ region: 'us-east-2' });
  }

  /**
   * This method is triggered when you run "app.listen()".
   */
  async listen(callback: () => void) {



    /**
     * The record processor must provide three functions:
     *
     * * `initialize` - called once
     * * `processRecords` - called zero or more times
     * * `shutdown` - called if this KCL instance loses the lease to this shard
     *
     * Notes:
     * * All of the above functions take additional callback arguments. When one is
     * done initializing, processing records, or shutting down, callback must be
     * called (i.e., `completeCallback()`) in order to let the KCL know that the
     * associated operation is complete. Without the invocation of the callback
     * function, the KCL will not proceed further.
     * * The application will terminate if any error is thrown from any of the
     * record processor functions. Hence, if you would like to continue processing
     * on exception scenarios, exceptions should be handled appropriately in
     * record processor functions and should not be passed to the KCL library. The
     * callback must also be invoked in this case to let the KCL know that it can
     * proceed further.
     */
    const recordProcessor = {
      /**
       * Called once by the KCL before any calls to processRecords. Any initialization
       * logic for record processing can go here.
       *
       * @param {object} initializeInput - Initialization related information.
       *             Looks like - {"shardId":"<shard_id>"}
       * @param {callback} completeCallback - The callback that must be invoked
       *        once the initialization operation is complete.
       */
      initialize: function(initializeInput, completeCallback) {
        // Initialization logic...
        completeCallback();
      },

      /**
       * Called by KCL with a list of records to be processed and checkpointed.
       * A record looks like:
       *     {"data":"<base64 encoded string>","partitionKey":"someKey","sequenceNumber":"1234567890"}
       *
       * The checkpointer can optionally be used to checkpoint a particular sequence
       * number (from a record). If checkpointing, the checkpoint must always be
       * invoked before calling `completeCallback` for processRecords. Moreover,
       * `completeCallback` should only be invoked once the checkpoint operation
       * callback is received.
       *
       * @param {object} processRecordsInput - Process records information with
       *             array of records that are to be processed. Looks like -
       *             {"records":[<record>, <record>], "checkpointer":<Checkpointer>}
       *             where <record> format is specified above.
       * @param {callback} completeCallback - The callback that must be invoked
       *             once all records are processed and checkpoint (optional) is
       *             complete.
       */
      processRecords: function(processRecordsInput, completeCallback) {
        if (!processRecordsInput || !processRecordsInput.records) {
          // Must call completeCallback to proceed further.
          completeCallback();
          return;
        }

        var records = processRecordsInput.records;
        var record, sequenceNumber, partitionKey, data;
        for (var i = 0 ; i < records.length ; ++i) {
          record = records[i];
          sequenceNumber = record.sequenceNumber;
          partitionKey = record.partitionKey;
          // Note that "data" is a base64-encoded string. Buffer can be used to
          // decode the data into a string.
          data = new Buffer(record.data, 'base64').toString();

          // Custom record processing logic ...
        }
        if (!sequenceNumber) {
          // Must call completeCallback to proceed further.
          completeCallback();
          return;
        }
        // If checkpointing, only call completeCallback once checkpoint operation
        // is complete.
        processRecordsInput.checkpointer.checkpoint(sequenceNumber,
          function(err, checkpointedSequenceNumber) {
            // In this example, regardless of error, we mark processRecords
            // complete to proceed further with more records.
            completeCallback();
          }
        );
      },

      /**
       * Called by the KCL to indicate that this record processor should shut down.
       * After the lease lost operation is complete, there will not be any more calls to
       * any other functions of this record processor. Clients should not attempt to
       * checkpoint because the lease has been lost by this Worker.
       *
       * @param {object} leaseLostInput - Lease lost information.
       * @param {callback} completeCallback - The callback must be invoked once lease
       *               lost operations are completed.
       */
      leaseLost: function(leaseLostInput, completeCallback) {
        // Lease lost logic ...
        completeCallback();
      },

      /**
       * Called by the KCL to indicate that this record processor should shutdown.
       * After the shard ended operation is complete, there will not be any more calls to
       * any other functions of this record processor. Clients are required to checkpoint
       * at this time. This indicates that the current record processor has finished
       * processing and new record processors for the children will be created.
       *
       * @param {object} shardEndedInput - ShardEnded information. Looks like -
       *               {"checkpointer": <Checpointer>}
       * @param {callback} completeCallback - The callback must be invoked once shard
       *               ended operations are completed.
       */
      shardEnded: function(shardEndedInput, completeCallback) {
        // Shard end logic ...

        // Since you are checkpointing, only call completeCallback once the checkpoint
        // operation is complete.
        shardEndedInput.checkpointer.checkpoint(function(err) {
          // In this example, regardless of the error, we mark the shutdown operation
          // complete.
          completeCallback();
        });
        completeCallback();
      }
    };

    kcl(recordProcessor).run();



  }

  /**
   * This method is triggered on application shutdown.
   */
  close() {}
}
