// import the original mapper
import MDXComponents from "@theme-original/MDXComponents";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import Image from "@theme/IdealImage";

export default {
  // re-use the default mapping
  ...MDXComponents,
  // some custom components goes here ...
  Tabs,
  TabItem,
  Image,
};
