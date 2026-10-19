require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoNativeWechat'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: package['repository'], tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'WechatOpenSDK-XCFramework', '2.0.9'

  # Compiler flags
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.exclude_files = ['**/.*', 'build/**/*']
end
