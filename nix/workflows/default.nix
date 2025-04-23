{
  callPackage,
  lib,
  self,
}:
{
  aiopusher = callPackage ./aiopusher { inherit self; };
  bumper = callPackage ./bumper { };
}
