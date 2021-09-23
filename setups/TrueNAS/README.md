# Installing NocoDB in FreeBSD/FreeNAS/TrueNAS jail

> As provided by [Zamana](https://github.com/Zamana) [here](https://gist.github.com/Zamana/e9281d736f9e9ce5882c6f4b140a590e)

First of all, make sure to refer and understand the general instructions in the official **NocoDB** site:

https://docs.nocodb.com/getting-started/installation

What you'll find here are the specific instructions to setup **NocoDB** in a FreeBSD system, or in a FreeNAS/TrueNAS CORE jail.

This was originally done in a TrueNAS CORE 12.0-U5.1, which uses FreeBSD 12.4-RELEASE-p6 as base system.


## 0. Adjust your date/time (if necessary). 

In my specific case it is.
```
# rm /etc/localtime
# ln -s /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
```

## 1. Update your packages:
```
# pkg update
# pkg upgrade
```

## 2. Create the user 'nocodb'

and set its home folder to '/usr/local/share/nocodb', that's where the application will be saved:
```
# pw add user nocodb -d /usr/local/share/nocodb
```

## 3. Install the packages

'git' and 'npm', and optionaly the database(s) you intend to use. By default **NocoDB** uses sqlite3:
```
# pkg install git npm postgresql14-server postgresql14-client
```

## 4. Clone the repository:

Go to the 'nocodb' home folder, clone the repository, and grant the access:
```
# cd /usr/local/share/nocodb
# git clone https://github.com/nocodb/nocodb-seed
# chown -R nocodb:nocodb nocodb-seed
```

## 5. Install the whole shebang

Enter in the folder just created and run the 'install' command:
```
# cd nocodb-seed
# npm install
```

If everything ran fine, you are ready to run the app, but hold on, because you'll need to make the FreeBSD setup.


## 6. Folder for the PID

Create a folder to save the PID file for the process, and grant the access:
```
# mkdir /var/run/nocodb/
# chown -R nocodb:nocodb /var/run/nocodb
```

## 7. Init script

Save this file with the name **nocodb** at '/usr/local/etc/rc.d':
```
#!/bin/sh

#
# Author: C. R. Zamana (czamana at gmail dot com)
#
# PROVIDE: nocodb
# REQUIRE: networking
# KEYWORD:

. /etc/rc.subr

name="nocodb"
rcvar="${name}_enable"
load_rc_config ${name}

: ${nocodb_enable:="NO"}
: ${nocodb_user:="nocodb"}

pidfile="/var/run/nocodb/nocodb.pid"

start_precmd="nocodb_precmd"

PATH=$PATH:/usr/local/bin

nocodb_precmd() {
        cd $(getent passwd ${nocodb_user} | cut -d\: -f6)
        cd nocodb-seed
}

command="/usr/sbin/daemon"
command_args="-P ${pidfile} /usr/local/bin/npm start > /dev/null"

run_rc_command "$1"
```

and grant the execution permissions:
```
# chmod +x /usr/local/etc/rc.d/nocodb
```

## 8. Run at boot

Configure the service to run automagically at system/jail boot:
```
# sysrc nocodb_enable=YES
```

From now on you can control the service with:
```
# service nocodb start | stop | status
```

but first is necessary to change the IP where **NocoDB** listens. That's because it came by default listening at **localhost** only, which is not pratical if you need to access the app from outside the server, what's generally true.

For this, edit the file **.env** and add a definition for the variable **HOST** pointing to your IP or more generally to **0.0.0.0**, so **NocoDB** will listen on every interface available. For example:
```
# vi /usr/local/share/nocodb/nocodb-seed/.env
```
and set **HOST** to your desired IP:

```
HOST=192.168.0.101
```

## 9. Change 'index.js'

Now edit the file 'usr/local/share/nocodb/nocodb-seed/index.js', and change the line with **localhost** to **${process.env.HOST}**. At the end you want your **index.js** file to looks like this:
```
(async () => {
    const app = require('express')();
    const {Noco} = require("nocodb");
    app.use(await Noco.init({}));
    console.log(`Visit : ${process.env.HOST}:${process.env.PORT}/dashboard`)
    app.listen(process.env.PORT);
})()
```

## 10. Start the service:
```
# service start nocodb
```

and make sure that it is running and listening at port 8080:
```
# service status nocodb
nocodb is running as pid 60058. <<-- your PID will be different...

# netstat -an | grep -iw listen
tcp46      0      0 *.8080                 *.*                    LISTEN <<<---- here it is
tcp46      0      0 *.8083                 *.*                    LISTEN
tcp4       0      0 127.0.0.1.5432         *.*                    LISTEN
tcp6       0      0 ::1.5432               *.*                    LISTEN
```

Now the service should be accessible through your browser:

```
http://<jail|freebsd IP>:8080
```

Congratulations!


## 11. Update/Upgrade

In order to update/upgrade the app, execute:
```
# service nocodb stop
# cd /usr/local/share/nocodb/nocodb-seed
# git pull
# npm uninstall nocodb
# npm install --save nocodb
# service nocodb start
```

> Feel free to point out any mistakes I made, including misspellings, typos and grammar errors.