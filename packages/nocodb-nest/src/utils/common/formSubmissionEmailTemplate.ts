export default `<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>NocoDB forms: someone has responded to Form</title>
    <style>
        @media only screen and (max-width: 620px) {
            table[class=body] h1 {
                font-size: 28px !important;
                margin-bottom: 10px !important;
            }

            table[class=body] p,
            table[class=body] ul,
            table[class=body] ol,
            table[class=body] td,
            table[class=body] span,
            table[class=body] a {
                font-size: 16px !important;
            }

            table[class=body] .wrapper,
            table[class=body] .article {
                padding: 10px !important;
            }

            table[class=body] .content {
                padding: 0 !important;
            }

            table[class=body] .container {
                padding: 0 !important;
                width: 100% !important;
            }

            table[class=body] .main {
                border-left-width: 0 !important;
                border-radius: 0 !important;
                border-right-width: 0 !important;
            }

            table[class=body] .btn table {
                width: 100% !important;
            }

            table[class=body] .btn a {
                width: 100% !important;
            }

            table[class=body] .img-responsive {
                height: auto !important;
                max-width: 100% !important;
                width: auto !important;
            }
        }

        @media all {
            .ExternalClass {
                width: 100%;
            }

            .ExternalClass,
            .ExternalClass p,
            .ExternalClass span,
            .ExternalClass font,
            .ExternalClass td,
            .ExternalClass div {
                line-height: 100%;
            }

            .apple-link a {
                color: inherit !important;
                font-family: inherit !important;
                font-size: inherit !important;
                font-weight: inherit !important;
                line-height: inherit !important;
                text-decoration: none !important;
            }

            #MessageViewBody a {
                color: inherit;
                text-decoration: none;
                font-size: inherit;
                font-family: inherit;
                font-weight: inherit;
                line-height: inherit;
            }

            .btn-primary table td:hover {
                background-color: #34495e !important;
            }

            .btn-primary a:hover {
                background-color: #34495e !important;
                border-color: #34495e !important;
            }
        }
    </style>
</head>
<body class=""
      style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
<span class="preheader"
      style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">NocoDB forms: someone has responded to Form</span>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body"
       style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f6f6f6; width: 100%;"
       width="100%" bgcolor="#f6f6f6">
    <tr>
        <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
        <td class="container"
            style="font-family: sans-serif; font-size: 14px; vertical-align: top; display: block; max-width: 580px; padding: 10px; width: 580px; margin: 0 auto;"
            width="580" valign="top">
            <div class="content"
                 style="box-sizing: border-box; display: block; margin: 0 auto; max-width: 580px; padding: 10px;">

                <!-- START CENTERED WHITE CONTAINER -->
                <table role="presentation" class="main"
                       style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background: #ffffff; border-radius: 3px; width: 100%;"
                       width="100%">

                    <!-- START MAIN CONTENT AREA -->
                    <tr>
                        <td class="wrapper"
                            style="font-family: sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;"
                            valign="top">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                                   style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                   width="100%">
                                   
                                   <tr>
                                   <td style="font-family: sans-serif; font-size: 14px;padding: 20px 5px 10px 5px; " colspan="2">
                                     <a href="https://github.com/nocodb/nocodb" target="_blank">
                                        <img src="https://www.nocodb.com/brand/x1.png" alt="NocoDB" width="70" style=" vertical-align: middle"> <h2 style="margin-left: 10px;display: inline-block">NocoDB</h2>
                                     </a>
                                   </td>
                                   </tr>
                                   <tr>
                                   <td style="font-family: sans-serif; font-size: 14px;line-height: 20px; vertical-align: top;padding: 10px 5px 40px 5px; " colspan="2">
                                     Someone has responded to Form. A record has been added to the subscriptions table in <span style="font-weight: bold"><%- _tn %></span>.
                                   </td>
                                   </tr>
                                   
                                <% Object.keys(data).forEach(function(prop) { 
                                if(data[prop] !== null && data[prop] !== undefined && data[prop] !== ''){
                                %>
                                  <tr>
                                      <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;padding: 20px 5px 20px 5px;text-transform: capitalize "
                                          valign="top">
                                            <%- prop %>
                                      </td>
                                      <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;padding: 20px 5px 20px 5px;"
                                          valign="top">
                                            <%- data[prop] %>
                                      </td>
                                  </tr>
                                <% }
                                }); %>
                            </table>
                        </td>
                    </tr>

                    <!-- END MAIN CONTENT AREA -->
                </table>
                <!-- END CENTERED WHITE CONTAINER -->

                <!-- START FOOTER -->
                <div class="footer" style="clear: both; margin-top: 10px; text-align: center; width: 100%;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                           style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                           width="100%">
                        <tr>
                            <td class="content-block"
                                style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #999999; font-size: 12px; text-align: center;"
                                valign="top" align="center">
                                <span class="apple-link"
                                      style="color: #999999; font-size: 12px; text-align: center;"></span>
                                <!--                <br> Don't like these emails? <a href="http://i.imgur.com/CScmqnj.gif">Unsubscribe</a>.-->
                            </td>
                        </tr>
                        <tr>
                            <td class="content-block powered-by"
                                style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #999999; font-size: 12px; text-align: center;"
                                valign="top" align="center">
                                <a href="https://github.com/nocodb/nocodb">NocoDB</a>
                                <!--                Powered by <a href="http://htmlemail.io">HTMLemail</a>.-->
                            </td>
                        </tr>
                    </table>
                </div>
                <!-- END FOOTER -->

            </div>
        </td>
        <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
    </tr>
</table>
</body>
</html>
`;
